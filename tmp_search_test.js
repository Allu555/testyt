const searchFunction = require('./netlify/functions/search.js').handler;
async function test() {
    const event = {
        httpMethod: 'GET',
        queryStringParameters: { q: 'Pehle Bhi Main Vishal Mishra' }
    };
    const context = {};
    const res = await searchFunction(event, context);
    console.log(res);
}
test();
