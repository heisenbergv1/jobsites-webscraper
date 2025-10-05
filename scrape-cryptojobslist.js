/**
 * Dynamic web page scrapping using puppeteer
 */

const airtable = require('./utils');
const puppeteer = require('puppeteer');
const fs = require('fs');

const writeStream = fs.createWriteStream('jobs.csv');

writeStream.write(`"Company", "Logo", "Size", "Position Title", "Type Of Contract", "Role", "Description", "Location", "Career Page", "Created Time", "Tags", "Compensation Estimate", "Contact" \n`);

(async function() {
    await new Promise((resolve, _) => airtable.selectRecords(airtable.deleteRecords, resolve));
    const homeRoute = 'https://cryptojobslist.com';
    console.log("Loading " + homeRoute);
    const browser = await puppeteer.launch();
    const homePage = await browser.newPage();
    await homePage.setDefaultNavigationTimeout(0);
    await homePage.goto(homeRoute, { waitUntil: 'domcontentloaded' });
    await homePage.setViewport({ width: 1200, height: 800 });
    await homePage.waitForSelector('div > button.btn-blue');
    await homePage.$eval('div > button.btn-blue', button => button.click() );
    await autoScroll(homePage); // to trigger some scripts
    await homePage.screenshot({ path: 'page-snapshot.png', fullPage: true});
    console.log('> Collecting job links...');
    const jobs = await homePage.evaluate(async () => {
        const selector = {
            logo: 'span.JobPreviewInline_companyLogoContainer__b5jlx > div > img',
            size: 'span.JobPreviewInline_meta__tG6WQ span.JobPreviewInline_applications__ooYzK',
            job_link: 'span.JobPreviewInline_meta__tG6WQ a.JobPreviewInline_jobTitle__WYzmv',
        };
        const items = Array.from(document.querySelectorAll('.JobPreviewInline_JobPreviewInline__uAIxU'));
        return await Promise.all(items.map(async (item) => {
            const jobLink = item.querySelector(selector.job_link)?.getAttribute('href') ?? 'N/A';
            return {
                job_link: 'https://cryptojobslist.com' + jobLink, 
            };
        }));
    });
    console.log('> Successful! Total job links: ' + jobs.length);
    const jobPage = await browser.newPage();
    await jobPage.setDefaultNavigationTimeout(0);
    for (let index = 0; index < jobs.length; index++) {
        const job = jobs[index];
        console.log('Processing ' + job.job_link);
        await jobPage.goto(job.job_link, { waitUntil: 'domcontentloaded' });
        try { 
            console.log('> Loading page...');
            await jobPage.waitForSelector('h2.JobView_companyName__vcxpI > a'); 
        } 
        catch (error) { console.log('> Error: something went wrong while loading job page.'); }
        await autoScroll(jobPage);
        console.log('> Evaluating...');
        const data = await jobPage.evaluate(async () => {
            const company = {
                name: 'h2.JobView_companyName__vcxpI > a',
                logo: 'div img.JobView_companyLogo__R4LHd',
                size: 'div div.total-applications',
                position_title: 'div > div > h1',
                type_of_contract: 'div > div > div.sticky > div:nth-child(4)',
                role: 'div > div > div.sticky > div:nth-child(3) > a',
                location: 'div > div > div.sticky > div:nth-child(1)',
                created_time: 'div > div > div > div.stats > div:nth-child(2)',
                tags: 'div > div > div.sticky',
                job_description: 'div > div > div.JobView_description__tW863 > div',
            };
            const companyName = document.querySelector(company.name)?.textContent ?? 'N/A';
            const companyLogo = document.querySelector(company.logo)?.getAttribute('src') ?? 'N/A';
            const positionTitle = document.querySelector(company.position_title)?.textContent ?? 'N/A';
            const companySize = (() => {
                const dataStr = document.querySelector(company.size)?.getAttribute('title') ?? null;
                const data = dataStr ? (dataStr.split(' ')[0] ?? 'N/A') : 'N/A';
                return data;
            })();
            const typeOfContract = (() => {
                const dataStr = document.querySelector(company.type_of_contract)?.textContent ?? null;
                const data = dataStr ? (dataStr.split(' ')[1] ?? 'N/A') : 'N/A';
                return data;
            })();
            const role = (() => {
                const dataStr = document.querySelector(company.role)?.textContent ?? null;
                const data = dataStr ? (dataStr.split(' ')[1] ?? 'N/A') : 'N/A';
                return data;
            })();
            const description = (() => {
                const data = document.querySelector(company.job_description)?.textContent.replace(/"/g, "'") ?? 'N/A';
                return data;
            })();
            const location = (() => {
                const dataStr = document.querySelector(company.location)?.textContent ?? null;
                const data = dataStr ? (dataStr.split(/ (.*)/s)[1] ?? 'N/A') : 'N/A';
                return data;
            })();
            const careerPage = 'N/A';
            const createdTime = (() => {
                const dataStr = document.querySelector(company.created_time)?.textContent ?? null;  
                const data = dataStr ? (dataStr.split(' on ')[1] ?? 'N/A') : 'N/A';
                return data;
            })();
            const tags = (() => {
                const tagsChildren = document.querySelector(company.tags)?.children ?? null;
                let data = '';
                if (tagsChildren?.length) {
                    for (let i = 0; i < 4; i++) {
                        data += tagsChildren[i]?.textContent + ', ';
                    }
                }
                return data;
            })();
            const compensationEstimate = 'N/A';
            const contact = 'N/A';

            return {
                name: companyName,
                logo: companyLogo,
                size: companySize,
                position_title: positionTitle,
                type_of_contract: typeOfContract,
                role: role,
                description: description, 
                location: location, 
                career_page: careerPage, 
                created_time: createdTime, 
                tags: tags, 
                compensation_estimate: compensationEstimate, 
                contact: contact, 
            };
        });
        // can't write inside async function
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
        airtable.createRecords([{ 'fields': record }]);
        console.log('> Successful: ', data);
    }
    await browser.close();
})();

async function autoScroll(page) {
    return await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(async() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight - window.innerHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 200);
        });
        return;
    });
}