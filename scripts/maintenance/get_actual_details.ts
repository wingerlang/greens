import { kv } from "../../src/api/kv.ts";

async function getActualDetails() {
    const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";
    const date = "2026-05-07";
    const id = "1778134044563-718o780";
    
    const res = await kv.get(['activities', userId, date, id]);
    console.log(JSON.stringify(res.value, null, 2));
}

getActualDetails();
