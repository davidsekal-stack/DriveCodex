// Fetch a few original forum threads and print readable text to compare against stored cases.
const targets = [
  { id:"radiator-heating", url:"https://www.skoda-club.net/forum-tema/vymena-radiatoru-topeni-80561",
    expect:"flushed circuit / new radiator (no-heating, hose hot in cold out)" },
  { id:"wipers-rodent", url:"https://www.skoda-club.net/forum-tema/stierace-nefunkcne-11558",
    expect:"rodent ate wiring (wipers not working)" },
  { id:"fordtransit", url:"https://fordtransit.org/forum/viewtopic.php?f=2&t=172092",
    expect:"(fordtransit thread)" },
];
const UA = "Mozilla/5.0 (compatible; DriveCodexAudit/1.0; +https://example.invalid)";
function strip(html){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&")
    .replace(/&[a-z]+;/gi," ").replace(/\s+/g," ").trim();
}
for(const t of targets){
  console.log(`\n===== ${t.id} =====\n${t.url}\nexpect: ${t.expect}`);
  try{
    const res = await fetch(t.url, { headers:{ "User-Agent":UA, "Accept-Language":"cs,en" }, redirect:"follow" });
    console.log("HTTP", res.status, res.headers.get("content-type"));
    if(!res.ok){ console.log("  (non-OK; body snippet)", (await res.text()).slice(0,200)); continue; }
    const text = strip(await res.text());
    console.log("  length:", text.length);
    // print a window; forums put posts in the middle
    console.log("  TEXT:", text.slice(0, 1800));
  }catch(e){ console.log("  FETCH ERROR:", e.message); }
}
