import { kv } from "../../src/api/kv.ts";

async function fixMapping() {
    const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";
    const plannedId = "1778134034734-4bp9hk6";
    const targetActualId = "017199f0-230b-40d2-aee6-971e0d638f92";
    const targetActualDistance = 7.00;
    const targetActualTimeSeconds = 2419;
    
    const plannedRes = await kv.get(["planned_activities", userId, plannedId]);
    if (!plannedRes.value) {
        console.error("Planned activity not found");
        return;
    }
    
    const planned = plannedRes.value as any;
    const oldExternalId = planned.externalId;
    
    planned.externalId = targetActualId;
    planned.actualDistance = targetActualDistance;
    planned.actualTimeSeconds = targetActualTimeSeconds;
    planned.reconciliation = {
        score: 100,
        matchReason: "Manuell matchning (återställd efter dubbelmappning)",
        bestCandidateId: targetActualId,
        reconciledAt: new Date().toISOString()
    };
    
    await kv.set(["planned_activities", userId, plannedId], planned);
    console.log(`Successfully re-mapped activity ${plannedId} from ${oldExternalId} to ${targetActualId}!`);
}

fixMapping();
