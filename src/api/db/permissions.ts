import { kv } from "../kv.ts";
import { PermissionConfig, DEFAULT_PERMISSION_CONFIG } from "../../models/types.ts";

export async function getPermissionConfig(): Promise<PermissionConfig> {
    const entry = await kv.get(['system', 'permission_config']);
    return (entry.value as PermissionConfig) || DEFAULT_PERMISSION_CONFIG;
}

export async function updatePermissionConfig(config: PermissionConfig): Promise<void> {
    await kv.set(['system', 'permission_config'], config);
}
