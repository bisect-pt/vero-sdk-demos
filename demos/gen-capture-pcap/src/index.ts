import {
    VERO,
    GenlockFamily,
    GeneratorChannelId,
    ICaptureConfiguration,
    CaptureJobState,
    IRateCondition,
} from '@mipw/vero-sdk';
import { v1 as uuid } from 'uuid';
import yargs from 'yargs';

const parser = yargs(process.argv.slice(2))
    .usage('Usage: $0 <command> [options]')
    .command('gen-capture-pcap', 'Run the generator and capture script.')
    .demandCommand(1, 1)
    .example(
        'yarn run gen-capture-pcap -b http://localhost',
        'Run the generator and capture script against http://localhost.'
    )
    .alias('p', 'password')
    .nargs('p', 1)
    .describe('p', `The password`)
    .default('p', 'user')
    .alias('u', 'username')
    .nargs('u', 1)
    .describe('u', `The user`)
    .default('u', 'user')
    .help('h')
    .alias('h', 'help')
    .options({
        b: {
            type: 'string',
            alias: 'address',
            nargs: 1,
            describe: 'Name or IP address of the host',
        },
        u: { type: 'string' },
        p: { type: 'string' },
    })
    .demandOption('b')
    .wrap(120)
    .epilog('© 2021 MIPW Lda - All rights reserved');

const argv: {
    _: (string | number)[];
    [x: string]: unknown;
    b: string | undefined;
    p: string | undefined;
} = parser.argv;

const address = `${argv.b}`;
const username = argv.u as string;
const password = argv.p as string;

const captureCompletionTimeoutMs = 55000;
const setGenlockTimeoutMs = 5000;
const startGeneratorTimeoutMs = 2000;
const activeRateTimeoutMs = 4000;
const connectorSourceIndex = 0;
const connectorKind = 'video';

function getActiveRateCondition(): IRateCondition[] {
    // TODO: make this depend on the profile
    return [
        {
            kind: 'moreThan',
            rates: { 'SFP A': 0, 'SFP B': 700000000 },
        },
    ];
}

async function generatorCapturePcap(username: string, password: string, address: string): Promise<void> {
    const senderProfile = {
        id: '7d390970-VERO-11ea-b7c2-0de9f6c32be1',
        meta: {
            description: '720p Narrow',
            isSystemProfile: true,
        },
        senders: {
            _id: '6127ba78f6019707b357629f',
            video: [
                {
                    isActive: true,
                    settings: {
                        resolution: 'HDReady',
                        schedule: {
                            kind: 'narrow',
                        },
                        enableMovingBar: true,
                        patternId: '0',
                    },
                    network: {
                        enabled: true,
                        useDefaultAddress: true,
                        useRedundancy: false,
                        primary: {
                            destAddr: '',
                            destPort: '',
                        },
                        secondary: {
                            destAddr: '',
                            destPort: '',
                        },
                        rtp: {
                            tsDelta: '0',
                            payloadId: '96',
                            ssrc: '0',
                        },
                    },
                },
            ],
            audio: [
                {
                    isActive: true,
                    settings: {
                        audioChannels: '2',
                        packetTime: '1ms',
                    },
                    network: {
                        enabled: true,
                        useDefaultAddress: true,
                        useRedundancy: false,
                        primary: {
                            destAddr: '',
                            destPort: '',
                        },
                        secondary: {
                            destAddr: '',
                            destPort: '',
                        },
                        rtp: {
                            tsDelta: '0',
                            payloadId: '97',
                            ssrc: '0',
                        },
                    },
                },
                {
                    isActive: true,
                    settings: {
                        audioChannels: '8',
                        packetTime: '1ms',
                    },
                    network: {
                        enabled: true,
                        useDefaultAddress: true,
                        useRedundancy: false,
                        primary: {
                            destAddr: '',
                            destPort: '',
                        },
                        secondary: {
                            destAddr: '',
                            destPort: '',
                        },
                        rtp: {
                            tsDelta: '0',
                            payloadId: '97',
                            ssrc: '0',
                        },
                    },
                },
                {
                    isActive: true,
                    settings: {
                        audioChannels: '8',
                        packetTime: '125us',
                    },
                    network: {
                        enabled: true,
                        useDefaultAddress: true,
                        useRedundancy: false,
                        primary: {
                            destAddr: '',
                            destPort: '',
                        },
                        secondary: {
                            destAddr: '',
                            destPort: '',
                        },
                        rtp: {
                            tsDelta: '0',
                            payloadId: '97',
                            ssrc: '0',
                        },
                    },
                },
                {
                    isActive: true,
                    settings: {
                        audioChannels: '64',
                        packetTime: '125us',
                    },
                    network: {
                        enabled: true,
                        useDefaultAddress: true,
                        useRedundancy: false,
                        primary: {
                            destAddr: '',
                            destPort: '',
                        },
                        secondary: {
                            destAddr: '',
                            destPort: '',
                        },
                        rtp: {
                            tsDelta: '0',
                            payloadId: '97',
                            ssrc: '0',
                        },
                    },
                },
            ],
            anc: [
                {
                    isActive: true,
                    network: {
                        enabled: true,
                        useDefaultAddress: true,
                        useRedundancy: false,
                        primary: {
                            destAddr: '',
                            destPort: '',
                        },
                        secondary: {
                            destAddr: '',
                            destPort: '',
                        },
                        rtp: {
                            tsDelta: '0',
                            payloadId: '100',
                            ssrc: '0',
                        },
                    },
                },
            ],
            alpha: [
                {
                    isActive: false,
                    network: {
                        enabled: true,
                        useDefaultAddress: true,
                        useRedundancy: false,
                        primary: {
                            destAddr: '',
                            destPort: '',
                        },
                        secondary: {
                            destAddr: '',
                            destPort: '',
                        },
                        rtp: {
                            tsDelta: '0',
                            payloadId: '101',
                            ssrc: '0',
                        },
                    },
                },
            ],
        },
    };

    const connectorSource = {
        enabled: true,
        source: {
            id: '74c3ca30-0688-11ec-a847-11c4d6988837',
            meta: {
                name: 'Video #1',
            },
            network: {
                primary: {
                    multicastAddress: '239.200.1.1',
                    destinationPort: '5000',
                },
                secondary: {
                    multicastAddress: '239.100.1.1',
                    destinationPort: '5000',
                },
                useRedundancy: true,
            },
        },
    };

    const captureSettings: ICaptureConfiguration = {
        name: 'Capture test script',
        duration: 200,
        sfpAEnabled: true,
        sfpBEnabled: true,
        enableListAnalysis: true,
        id: uuid(),
    };

    const vero = new VERO(address);

    try {
        await vero.login(username, password);

        const genlockWaitResult = await vero.settings.setGenlockSync(
            { family: GenlockFamily.genlock25 },
            setGenlockTimeoutMs
        );

        const generatorAwaiter = vero.signalGenerator.makeAwaiter(
            GeneratorChannelId.channel1,
            senderProfile.id,
            startGeneratorTimeoutMs
        );
        await vero.signalGenerator.start(GeneratorChannelId.channel1, senderProfile);
        const generatorWaitResult = await generatorAwaiter;
        if (!generatorWaitResult) throw new Error('Timeout waiting for the generator to start');

        await vero.capture.selectSource(connectorKind, connectorSourceIndex, connectorSource);
        const activeRateAwaiter = await vero.capture.makeSfpStateAwaiter(getActiveRateCondition(), activeRateTimeoutMs);
        if (!activeRateAwaiter) {
            throw new Error('Timeout waiting for the minimum rate');
        }

        const captureAwaiter = vero.capture.makeCaptureAwaiter(captureSettings.id, captureCompletionTimeoutMs);
        await vero.capture.start(captureSettings);
        const captureResult = await captureAwaiter;

        if (!captureResult) {
            throw new Error('Timeout waiting for the capture to complete');
        }
        if (captureResult.state !== CaptureJobState.Completed) {
            throw new Error('Capture failed');
        }

        if (!captureResult.result?.analysis) {
            throw new Error('Pcap doesnt exist');
        }
    } finally {
        vero.close();
    }
}

async function run(): Promise<void> {
    for (const arg of argv._) {
        if (arg === 'gen-capture-pcap') {
            try {
                await generatorCapturePcap(username, password, address);
                process.exit(0);
            } catch (e) {
                console.log(`Error: ${JSON.stringify(e)}`);
            }
        }
    }
}

run().catch((e) => {
    process.stderr.write(`Error: ${e} ${e.stack}\n`);
    process.exit(-1);
});
