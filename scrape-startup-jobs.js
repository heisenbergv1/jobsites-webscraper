const airtable = require('./utils');
const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');

const writeStream = fs.createWriteStream('jobs.csv');

writeStream.write(`"Company", "Logo", "Size", "Position Title", "Type Of Contract", "Role", "Description", "Location", "Career Page", "Created Time", "Tags", "Compensation Estimate", "Contact" \n`);

const company = {
    name: 'div.postCard__main > div.postCard__companyName',
    logo: 'section:nth-child(3) > div > header.visualHeader > div.visualHeader__image',
    position_title: 'div.postCard__main > a.postCard__title',
    location: 'section:nth-child(4) > div > div > div.jobListing__main > div.jobListing__main__meta > div.jobListing__main__meta__location',
    tags: 'div.postCard__tags',
    job_description: 'section:nth-child(4) > div > div > div.jobListing__main > div.jobListing__main__text',
    type_of_contract: 'section:nth-child(4) > div > div > div.jobListing__main > div.jobListing__main__meta > div.jobListing__main__meta__commitment'
};

const domain = 'https://startup.jobs';

function scrape() {
    request(domain, (error, response, html) => {
        if(!error && response.statusCode == 200) {
            const $ = cheerio.load(html);
            const jobs = $('div:nth-child(4) > div:nth-child(2) > section > div > div.postCard');
            jobs.each((i, job) => { 
                const jobUrl = $(job).find('div.postCard__main > a').attr('href');
                const companyName = $(job)?.find(company.name)?.text().trim() ?? 'N/A';
                const positionTitle = $(job)?.find(company.position_title)?.text().trim() ?? 'N/A';
                const tags = $(job)?.find(company.tags)?.text().trim() ?? 'N/A';
                request(domain + jobUrl, (error, response, html) => {
                    if (!error && response.statusCode == 200) {
                        const $ = cheerio.load(html);
                        const companyLogo = $(company.logo)?.css('background-image').replace("url('","").replace("')","").replace(/\"/gi, "") ?? 'N/A';
                        const applicationSize = 'N/A';
                        const typeOfContract = $(company.type_of_contract)?.text().trim() ?? 'N/A';
                        const role = 'N/A';
                        const description = $(company.job_description)?.text().trim().replace(/"/g, "'") ?? 'N/A';
                        const location = $(company.location)?.text().trim() ?? 'N/A';
                        const careerPage = 'N/A';
                        const createdTime = 'N/A';
                        const compensationEstimate = 'N/A';
                        const contact = "N/A";
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
                        writeStream.write(`"${companyName}", "${companyLogo}", "${applicationSize}", "${positionTitle}", "${typeOfContract}", "${role}", "${description}", "${location}", "${careerPage}", "${createdTime}", "${tags}", "${compensationEstimate}", "${contact}" \n`);
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