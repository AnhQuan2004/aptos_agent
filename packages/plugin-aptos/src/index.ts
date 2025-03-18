import createBounty from "./actions/create_bounty.ts";
import giveInsightData from "./actions/give-insight-data.ts";
import checkVerify from "./actions/check_verify.ts";    

//export all actions
export { createBounty, giveInsightData, checkVerify };


export const aptosPlugin = {
    name: "aptos",
    description: "Aptos Plugin for Eliza",
    actions: [createBounty, giveInsightData, checkVerify],
    evaluators: [],
    // providers: [walletProvider],
};

export default aptosPlugin;
