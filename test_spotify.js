const fs = require('fs');
async function test() {
    const res = await fetch("https://open.spotify.com/embed/playlist/37i9dQZEVXbNFJfN1Vw8d9");
    const html = await res.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (nextDataMatch) {
        const data = JSON.parse(nextDataMatch[1]);
        const entity = data?.props?.pageProps?.state?.data?.entity;
        if (entity) {
            fs.writeFileSync('tmp_test_out.json', JSON.stringify({ coverArt: entity.coverArt, images: entity.images }, null, 2), 'utf8');
        }
    }
}
test();
