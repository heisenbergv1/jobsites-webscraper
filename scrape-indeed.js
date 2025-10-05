/**
 * Dynamic web page scrapping using puppeteer
 */

const airtable = require('./utils');
const puppeteer = require('puppeteer');
const fs = require('fs');

const writeStream = fs.createWriteStream('jobs.csv');

writeStream.write(`"Company", "Logo", "Size", "Position Title", "Type Of Contract", "Role", "Description", "Location", "Career Page", "Created Time", "Tags", "Compensation Estimate", "Contact" \n`);

(async function() {
    // Clear Airtable first (original behavior)
    await new Promise((resolve, _) => airtable.selectRecords(airtable.deleteRecords, resolve));

    const homeRoute = 'https://ph.indeed.com/jobs?q=c%23&l=Manila&radius=25&from=searchOnHP&vjk=305d6615b05cb98a';
    console.log("Loading " + homeRoute);

    const browser = await puppeteer.launch();
    const homePage = await browser.newPage();
    await homePage.setDefaultNavigationTimeout(0);
    await homePage.goto(homeRoute, { waitUntil: 'domcontentloaded' });
    await homePage.setViewport({ width: 1200, height: 800 });

    // Wait for the blue button (kept original intent) but tolerate slightly different hierarchy
    try {
      await homePage.waitForSelector('div > button.btn-blue', { timeout: 5000 });
      await homePage.$eval('div > button.btn-blue', button => button.click());
    } catch (e) {
      // If button doesn't exist, continue — some pages may not show it
      console.log('> Notice: btn-blue not found or clickable; continuing without click.');
    }

    await autoScroll(homePage); // to trigger scripts
    await homePage.screenshot({ path: 'page-snapshot.png', fullPage: true});

    console.log('> Collecting job links...');

    // Collect the job links from the listing using selectors present in provided HTML.
    const jobs = await homePage.evaluate(() => {
        // Items: use slider_item data-testid
        const items = Array.from(document.querySelectorAll('div[data-testid="slider_item"]'));
        return items.map(item => {
            const anchor = item.querySelector('a.jcs-JobTitle') || item.querySelector('h2.jobTitle a');
            const href = anchor?.getAttribute('href') ?? null;
            const jobTitleSpan = anchor?.querySelector('span[id^="jobTitle-"]') || anchor?.querySelector('span[title]') || anchor?.textContent;
            const company = item.querySelector('span[data-testid="company-name"]')?.textContent?.trim() ?? 'N/A';
            const location = item.querySelector('[data-testid="text-location"]')?.textContent?.trim() ?? 'N/A';

            // normalize href to absolute if present
            const jobLink = href ? (href.startsWith('http') ? href : ('https://ph.indeed.com' + href)) : 'N/A';

            return {
                job_link: jobLink,
                listing_title: (jobTitleSpan && typeof jobTitleSpan === 'string') ? jobTitleSpan.trim() : (jobTitleSpan?.textContent?.trim?.() ?? 'N/A'),
                company,
                location
            };
        });
    });

    console.log('> Successful! Total job links: ' + jobs.length);

    const jobPage = await browser.newPage();
    await jobPage.setDefaultNavigationTimeout(0);

    for (let index = 0; index < jobs.length; index++) {
        const job = jobs[index];
        console.log(`Processing ${index + 1}/${jobs.length}: ${job.job_link}`);
        await jobPage.goto(job.job_link, { waitUntil: 'domcontentloaded' });

        try {
            console.log('> Loading page... (waiting for title)');
            // More robust: wait for h1 which typically contains the job title on the detail page
            await jobPage.waitForSelector('h1', { timeout: 8000 });
        } catch (error) {
            console.log('> Warning: timed out waiting for job detail title. Proceeding to evaluate anyway.');
        }

        await autoScroll(jobPage);
        console.log('> Evaluating...');

        const data = await jobPage.evaluate(() => {
            // helper: accept first matching selector from array
            const qFirst = (selectors) => {
                for (const s of selectors) {
                    const el = document.querySelector(s);
                    if (el) return el;
                }
                return null;
            };

            // Company name: try data-testid and several common fallbacks
            const companyNameEl = qFirst(['span[data-testid="company-name"]', 'div.jobsearch-CompanyInfoWithoutHeaderImage div', 'div.icl-u-lg-mr--sm']);
            const companyName = companyNameEl?.textContent?.trim() ?? 'N/A';

            // Company logo: try known img selectors
            const companyLogoEl = qFirst(['div img.JobView_companyLogo__R4LHd', 'img.company_logo', 'div[data-tn-component="companyLogo"] img']);
            const companyLogo = companyLogoEl?.getAttribute('src') ?? 'N/A';

            // Position/title - prefer h1
            const titleEl = qFirst(['h1', 'div > div > h1', 'h1.jobsearch-JobInfoHeader-title']);
            const positionTitle = titleEl?.textContent?.trim() ?? 'N/A';

            // Location - try data-testid and other fallbacks
            const locationEl = qFirst(['div[data-testid="text-location"]', 'div.jobsearch-JobInfoHeader-subtitle div', '.jobsearch-JobInfoHeader-subtitle > div']);
            const location = locationEl?.textContent?.trim() ?? 'N/A';

            // Type of contract & Role & Tags & Created time: the job detail page may place these in different sections.
            // We'll try to read metadata container lists if present (from listing markup these appear in 'jobMetaDataGroup' in listing).
            const metadataList = Array.from(document.querySelectorAll('ul.metadataContainer li, div.jobsearch-JobMetadataHeader-item'));
            let typeOfContract = 'N/A';
            let role = 'N/A';
            let tags = '';
            if (metadataList.length) {
                // collect first few metadata text values
                const metaTexts = metadataList.map(li => li.textContent?.trim()).filter(Boolean);
                // heuristics: first metadata entry is often contract (e.g., Full-time)
                if (metaTexts[0]) typeOfContract = metaTexts[0];
                // gather tags up to 4
                tags = metaTexts.slice(0, 4).join(', ');
            } else {
                // fallback: try to get some sticky/heading text
                const sticky = document.querySelector('div.sticky')?.textContent?.trim();
                if (sticky) tags = sticky;
            }

            // Created time / posted date: attempt to find "date posted" containers
            const createdEl = qFirst(['div[data-testid="posting-date"]', 'div#jobDetailsSection time', 'div.jobsearch-JobMetadataFooter'] );
            let createdTime = 'N/A';
            if (createdEl) {
                createdTime = createdEl.textContent?.trim() ?? 'N/A';
                // sanitize common patterns
                if (createdTime.includes('Posted')) {
                    createdTime = createdTime.split('Posted')?.pop()?.trim() ?? createdTime;
                }
            }

            // Job description - common Indeed container id/class
            const descriptionEl = qFirst(['div#jobDescriptionText', 'div.JobView_description__tW863', 'div.jobsearch-jobDescriptionText']);
            const jobDescription = descriptionEl ? (descriptionEl.textContent?.replace(/"/g, "'").trim() ?? 'N/A') : 'N/A';

            const careerPage = 'N/A';
            const compensationEstimate = 'N/A';
            const contact = 'N/A';
            const size = 'N/A';

            return {
                name: companyName,
                logo: companyLogo,
                size: size,
                position_title: positionTitle,
                type_of_contract: typeOfContract,
                role: role,
                description: jobDescription,
                location: location,
                career_page: careerPage,
                created_time: createdTime,
                tags: tags,
                compensation_estimate: compensationEstimate,
                contact: contact,
            };
        });

        // Write CSV line (preserve original format)
        writeStream.write(`"${data.name}", "${data.logo}", "${data.size}", "${data.position_title}", "${data.type_of_contract}", "${data.role}", "${data.description}", "${data.location}", "${data.career_page}", "${data.created_time}", "${data.tags}", "${data.compensation_estimate}", "${data.contact}" \n`);

        const record = {
            'Company': data.name,
            'Logo': data.logo,
            'Size': data.size,
            'Position Title': data.position_title,
            'Type Of Contract': data.type_of_contract,
            'Role': data.role,
            'Description': data.description,
            'Location': data.location,
            'Career Page': data.career_page,
            'Created Time': data.created_time,
            'Tags': data.tags,
            'Compensation Estimate': data.compensation_estimate,
            'Contact': data.contact,
        };

        // keep original airtable call
        airtable.createRecords([{ 'fields': record }]);

        console.log('> Successful: ', data);
    }

    await browser.close();
    writeStream.end();
})();
