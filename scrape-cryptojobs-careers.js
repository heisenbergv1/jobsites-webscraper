const airtable = require('./utils');
const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const writeStream = fs.createWriteStream('jobs.csv');

writeStream.write(`"Company", "Logo", "Size", "Position Title", "Type Of Contract", "Role", "Description", "Location", "Career Page", "Created Time", "Tags", "Compensation Estimate", "Contact" \n`);

const company = {
    name: 'div.jobsearch-main-content figure.jobsearch-jobdetail-list > figcaption > span > a',
    logo: 'div.jobsearch-main-content figure.jobsearch-jobdetail-list > span > a > img',
    position_title: 'div.jobsearch-main-content figure.jobsearch-jobdetail-list > figcaption > h2',
    location: 'div.jobsearch-main-content figure > figcaption > ul.jobsearch-jobdetail-options li:nth-child(1)',
    tags: 'div.jobsearch-main-content figure.jobsearch-jobdetail-list > figcaption > span > small:nth-child(1)',
    job_description: 'div.jobsearch-main-content div.jobsearch-description',
    compensation_estimate: 'div.jobsearch-main-content figure.jobsearch-jobdetail-list > figcaption > ul > li:nth-child(2)',
}
const domain = 'https://cryptojobs.careers/';

function scrape() {
    request(domain, (error, response, html) => {
        if(!error && response.statusCode == 200) {
            const $ = cheerio.load(html);
            const jobs = $('div > h2.jobsearch-pst-title > a');
            jobs.each((i, job) => { 
                const jobUrl = $(job).attr('href');
                request(jobUrl, (error, response, html) => {
                    if (!error && response.statusCode == 200) {
                        const $ = cheerio.load(html);
                        const companyName = $(company.name)?.text().trim().replace('@', '') ?? 'N/A';
                        const companyLogo = $(company.logo)?.attr('src') ?? 'N/A';
                        const applicationSize = 'N/A';
                        const positionTitle = $(company.position_title)?.text().trim() ?? 'N/A';
                        const typeOfContract = 'N/A';
                        const role = 'N/A';
                        const description = $(company.job_description)?.text().trim().replace(/"/g, "'") ?? 'N/A';
                        const location = $(company.location).text().trim() ?? 'N/A';
                        const careerPage = 'N/A';
                        const createdTime = 'N/A';
                        const tags = $(company.tags)?.text().trim() ?? 'N/A';
                        const compensationEstimate = $(company.compensation_estimate)?.text().trim() ?? 'N/A';
                        const contact = "N/A";
                        writeStream.write(`"${companyName}", "${companyLogo}", "${applicationSize}", "${positionTitle}", "${typeOfContract}", "${role}", "${description}", "${location}", "${careerPage}", "${createdTime}", "${tags}", "${compensationEstimate}", "${contact}" \n`);
                        const record = {
                            'Company': companyName,
                            'Logo': companyLogo,
                            'Size': applicationSize,
                            'Position Title': positionTitle,
                            'Type Of Contract': typeOfContract,
                            'Role': role,
                            'Description': description, 
                            'Location': location, 
                            'Career Page': careerPage, 
                            'Created Time': createdTime, 
                            'Tags': tags, 
                            'Compensation Estimate': compensationEstimate, 
                            'Contact': contact, 
                        };
                        airtable.createRecords([{ 'fields': record }]);
                        console.log(record);
                    }
                });
            });
        } else {
            console.log('Request Failed ');
        } 
    });
}

function main() {
    new Promise((resolve, _) => airtable.selectRecords(airtable.deleteRecords, resolve)).then(scrape);
}

main();