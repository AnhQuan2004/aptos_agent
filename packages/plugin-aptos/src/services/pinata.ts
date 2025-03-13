import axios from 'axios';
import * as fs from 'fs/promises';

// Pinata configuration
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY;

// Utility function to write logs to file
async function writeToLog(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    try {
        await fs.appendFile('pinata_log.txt', logMessage);
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
}

/**
 * Uploads data to Pinata IPFS
 * @param data The data to upload to Pinata
 * @returns Object containing the IPFS hash and gateway URL
 */
export const uploadToPinata = async (data: any): Promise<any> => {
    if (!PINATA_JWT || !PINATA_GATEWAY) {
        await writeToLog("Missing Pinata JWT or Gateway");
        return { code: 500, message: "Missing Pinata JWT or Gateway" };
    }
    
    try {
        const response = await axios.post(
            'https://api.pinata.cloud/pinning/pinJSONToIPFS',
            data,
            {
                headers: {
                    'Authorization': `Bearer ${PINATA_JWT}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const ipfsHash = response.data.IpfsHash;
        await writeToLog(`Uploaded to Pinata with hash: ${ipfsHash}`);
        
        return {
            IpfsHash: ipfsHash,
            url: `https://${PINATA_GATEWAY}/ipfs/${ipfsHash}`
        };
    } catch (error) {
        await writeToLog(`Failed to upload to Pinata: ${error.message}`);
        return { code: 500, message: "Failed to upload data to Pinata" };
    }
};

/**
 * Retrieves data from Pinata IPFS using the IPFS hash
 * @param ipfsHash The IPFS hash of the content to retrieve
 * @returns The data stored at the IPFS hash
 */
export const getFromPinata = async (ipfsHash: string): Promise<any> => {
    if (!PINATA_JWT || !PINATA_GATEWAY) {
        await writeToLog("Missing Pinata JWT or Gateway");
        return { code: 500, message: "Missing Pinata JWT or Gateway" };
    }
    
    try {
        // Gọi trực tiếp đến gateway để lấy dữ liệu
        const response = await axios.get(
            `https://blush-permanent-rat-990.mypinata.cloud/ipfs/${ipfsHash}`,
        );
        
        await writeToLog(`Retrieved data from Pinata with hash: ${ipfsHash}`);
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        await writeToLog(`Failed to retrieve data from Pinata: ${error.message}`);
        return { 
            success: false,
            code: error.response?.status || 500, 
            message: `Failed to retrieve data from Pinata: ${error.message}` 
        };
    }
};

/**
 * Checks if a pin exists on Pinata
 * @param ipfsHash The IPFS hash to check
 * @returns Information about the pin if it exists
 */
export const checkPinStatus = async (ipfsHash: string): Promise<any> => {
    if (!PINATA_JWT) {
        await writeToLog("Missing Pinata JWT");
        return { code: 500, message: "Missing Pinata JWT" };
    }
    
    try {
        const response = await axios.get(
            `https://api.pinata.cloud/pinning/pinJobs?ipfs_pin_hash=${ipfsHash}`,
            {
                headers: {
                    'Authorization': `Bearer ${PINATA_JWT}`
                }
            }
        );
        
        await writeToLog(`Checked pin status for hash: ${ipfsHash}`);
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        await writeToLog(`Failed to check pin status: ${error.message}`);
        return { 
            success: false,
            code: error.response?.status || 500, 
            message: `Failed to check pin status: ${error.message}` 
        };
    }
}; 