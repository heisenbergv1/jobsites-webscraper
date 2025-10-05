const airtable = require('./utils');
const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const writeStream = fs.createWriteStream('jobs.csv');

writeStream.write(`"Company", "Logo", "Size", "Position Title", "Type Of Contract", "Role", "Description", "Location", "Career Page", "Created Time", "Tags", "Compensation Estimate", "Contact" \n`);

const company = {
    name: '.table-job td a.job-url > span ',
    logo: '.table-job img.company-logo',
    size: '.table-job td > small > div > br',
    position_title: '.table-job p.job-title',
    type_of_contract: '.table-job td > a.job-url > div > small > span:nth-child(2)',
    role: '.table-job td > a.job-url > div > small > span:nth-child(1)',
    location: '.table-job td > a.job-url > div > small > span:nth-child(3)',
    created_time: '.table-job td > small > div > span',
    tags: '.table-job td > a.job-url > div > small',
    job_description: '.panel-body > p',
    compensation_estimate: 'div.content-panel > div.panel.panel-default > div > div.row > div:nth-child(2) > p:nth-child(2)'
}

function scrape() {
    request('https://crypto.jobs/', (error, response, html) => {
        if(!error && response.statusCode == 200) {
            const $ = cheerio.load(html);
            const jobs = $('.table-jobs a.job-url');
            jobs.each((i, job) => { 
                const jobUrl = $(job).attr('href');
                request(jobUrl, (error, response, html) => {
                    if(!error && response.statusCode == 200) {
                        const $ = cheerio.load(html);
                        const companyName = $(company.name)?.text() ?? 'N/A';
                        const companyLogo = $(company.logo)?.attr('src') ?? 'N/A';
                        const applicationSize = (() => {
                            const arr = $(company.size)[0]?.nextSibling?.data?.split(' ');
                            for (let index = 0; index < arr.length; index++) {
                                const data = arr[index];
                                if (!isNaN(parseInt(data))) return data;
                            }
                            return 'N/A';
                        })();
                        const positionTitle = $(company.position_title)?.text() ?? 'N/A';
                        const typeOfContract = $(company.type_of_contract)?.text().trim() ?? 'N/A';
                        const role = $(company.role)?.text().trim() ?? 'N/A';
                        const description = $(company.job_description)?.text().replace(/"/g, "'") ?? 'N/A';
                        const location = $(company.location)?.text().trim() ?? 'N/A';
                        const careerPage = 'N/A';
                        const createdTime = $(company.created_time)?.attr('datetime') ?? 'N/A';
                        const tags = $(company.tags)?.text().trim().replace(/\n\n\n/gi, ', ') ?? 'N/A';
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