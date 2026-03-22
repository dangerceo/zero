import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getSettings, saveSettings } from './settings.js';

const RP_NAME = 'Zero Computer';
const RP_ID = 'localhost'; // This will be dynamic in the middleware

// Challenge storage (in memory is fine for a single user system)
const currentChallenges = new Map();

export function generateRegistration(origin) {
    const host = origin.split('://')[1];
    const rpID = host.split(':')[0];
    const options = generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userID: 'zero-user',
        userName: 'Zero User',
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred',
        },
    });
    currentChallenges.set('registration', options.challenge);
    return options;
}

export async function verifyRegistration(body, origin) {
    const host = origin.split('://')[1];
    const rpID = host.split(':')[0];
    const expectedChallenge = currentChallenges.get('registration');
    const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
    });

    if (verification.verified) {
        const { registrationInfo } = verification;
        const { credentialID, credentialPublicKey, counter } = registrationInfo;
        
        // Save to settings
        await saveSettings({
            passkey: {
                credentialID: Buffer.from(credentialID).toString('base64'),
                credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
                counter,
                transports: body.response.transports || ['internal', 'usb', 'nfc', 'ble'],
            }
        });
        return { verified: true };
    }
    return { verified: false };
}

export async function generateAuthentication(origin) {
    const host = origin.split('://')[1];
    const rpID = host.split(':')[0];
    const settings = await getSettings();
    if (!settings.passkey) throw new Error('No passkey registered');

    const options = generateAuthenticationOptions({
        rpID,
        allowCredentials: [{
            id: Buffer.from(settings.passkey.credentialID, 'base64'),
            type: 'public-key',
            transports: settings.passkey.transports,
        }],
        userVerification: 'preferred',
    });
    currentChallenges.set('authentication', options.challenge);
    return options;
}

export async function verifyAuthentication(body, origin) {
    const host = origin.split('://')[1];
    const rpID = host.split(':')[0];
    const settings = await getSettings();
    const expectedChallenge = currentChallenges.get('authentication');

    const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
            credentialID: Buffer.from(settings.passkey.credentialID, 'base64'),
            credentialPublicKey: Buffer.from(settings.passkey.credentialPublicKey, 'base64'),
            counter: settings.passkey.counter,
        },
    });

    if (verification.verified) {
        // Update counter
        await saveSettings({
            passkey: {
                ...settings.passkey,
                counter: verification.authenticationInfo.newCounter,
            }
        });
        return { verified: true };
    }
    return { verified: false };
}
