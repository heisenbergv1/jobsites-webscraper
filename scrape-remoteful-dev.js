const airtable = require('./utils');
const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const writeStream = fs.createWriteStream('jobs.csv');

writeStream.write(`"Company", "Logo", "Size", "Position Title", "Type Of Contract", "Role", "Description", "Location", "Career Page", "Created Time", "Tags", "Compensation Estimate", "Contact" \n`);

const company = {
    name: 'section > div:nth-child(2) > div.column.is-3 > div > div > div.content > h3',
    logo: 'section > div:nth-child(2) > div.column.is-3 > div > div > div.media > figure > p > img',
    position_title: 'section > div:nth-child(2) > div.column.is-9 > div.content.is-medium > h1.title',
    location: 'section > div:nth-child(2) > div.column.is-9 > div.content.is-medium > div:nth-child(5) > p',
    tags: 'section > div:nth-child(2) > div.column.is-9 > div.content.is-medium > div.tags',
    job_description: 'section > div:nth-child(2) > div.column.is-9 > div.content.is-medium > div:nth-child(4) > div',
    created_time: 'section > div:nth-child(2) > div.column.is-9 > div.content.is-medium > h5',
};
const domain = 'https://remoteful.dev';

function scrape() {
    request(domain, (error, response, html) => {
        if(!error && response.statusCode == 200) {
            const $ = cheerio.load(html);
            const jobs = $('div.container div.column.is-four-fifths > a');
            jobs.each((i, job) => { 
                const jobUrl = $(job).attr('href');
                request(domain + jobUrl, (error, response, html) => {
                    if (!error && response.statusCode == 200) {
                        const $ = cheerio.load(html);
                        const companyName = $(company.name)?.text().trim() ?? 'N/A';
                        const companyLogo = $(company.logo)?.attr('src') ?? 'N/A';
                        const applicationSize = 'N/A';
                        const positionTitle = $(company.position_title)?.text().trim() ?? 'N/A';
                        const typeOfContract = 'N/A';
                        const role = 'N/A';
                        const description = $(company.job_description)?.text().trim().replace(/"/g, "'") ?? 'N/A';
                        const location = $(company.location).text().trim() ?? 'N/A';
                        const careerPage = 'N/A';
                        const createdTime = $(company.created_time)?.text().trim() ?? 'N/A';
                        const tags = $(company.tags)?.text().trim() ?? 'N/A';
                        const compensationEstimate = 'N/A';
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