const Airtable = require('airtable');
const dotenv = require('dotenv');
dotenv.config();
const airtableBase = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(process.env.AIRTABLE_BASE);
const airtableBaseName = process.env.AIRTABLE_BASE_NAME;
function selectRecords(callback = (_records, _resolve, _base ) => null, resolve = () => null, base = airtableBaseName) {
    console.log('Selecting Aritable records...');
    let tableRecordIds = [[]];
    airtableBase(base).select({
        // Selecting the first 3 records in Grid view:
        // maxRecords: 8,
        view: "Grid view"
    }).eachPage(function page(records, fetchNextPage) {
        // This function (`page`) will get called for each page of records.
        records.forEach(function(record) {
            // store record ids in array: [[10 records], [10 records], ...] because we can only delete 10 records at a time
            let recordsCount = tableRecordIds.length;
            let lastBatchIndx = recordsCount - 1; // getting last item (as batch of records) index
            let lastBatchCount = tableRecordIds[lastBatchIndx].length;
            if (lastBatchCount == 10) {
                tableRecordIds.push([]);
                tableRecordIds[lastBatchIndx + 1].push(record.id);
            } else tableRecordIds[lastBatchIndx].push(record.id);
        });
        // To fetch the next page of records, call `fetchNextPage`.
        // If there are more records, `page` will get called again.
        // If there are no more records, `done` will get called.
        fetchNextPage();
    }, function done(err) {
        if (err) { console.error(err); return; }
        callback(tableRecordIds, resolve, base);
    });
};
function deleteRecords(records = [], resolve = () => null, base = airtableBaseName) {
    console.log('Clearing Aritable base...');
    // delete 10 records at a time
    let destroyed = 0;
    records.forEach(batch => {
        airtableBase(base).destroy(batch, function(err, _deletedRecords) {
            destroyed++;
            if (err) console.error(err);
            if (destroyed === records.length) resolve();
            return;
        });
    })
};
function createRecords(records = [], base = airtableBaseName) {
    console.log('> Creating Aritable records...');
    airtableBase(base).create(records, function(err, records) {
        if (err) {
            console.error(err);
            return;
        }
        records.forEach(function (record) {
            console.log(record.getId());
        });
    });
};
module.exports = {
    selectRecords: selectRecords,
    deleteRecords: deleteRecords,
    createRecords: createRecords,
}