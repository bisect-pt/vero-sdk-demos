import {
    VERO,
    GenlockFamily,
    GeneratorChannelId,
    ICaptureConfiguration,
    CaptureJobState,
    IRateCondition,
} from '@mipw/vero-sdk';
import { SocketEvents, IGeneratorStatusEntry } from '@mipw/vero-api';
import { IGeneratorProfile, IGeneratorStatus } from '@mipw/vero-api';
import { v1 as uuid } from 'uuid';
import yargs from 'yargs';
import * as readline from 'readline';

const askForNumber = function (question: string, readline: any): Promise<number> {
    return new Promise((resolve, reject) => {
        readline.question(question, (answer: string) => {
            resolve(parseInt(answer));
        });
    });
};

function waitForSfpStatus(ws: SocketIOClient.Socket, timeoutMs: number): Promise<IGeneratorStatusEntry | undefined> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            ws.off('message', callback);
            resolve(undefined);
        }, timeoutMs);

        const eventName = SocketEvents.generatorStatus;

        const callback = (msg: IWSMessage) => {
            if (msg.event !== eventName) {
                return;
            }

            clearTimeout(timer);
            ws.off('message', callback);
            resolve(msg.data[0]);
        };

        ws.on('message', callback);
    });
}

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

export interface IWSMessage {
    event: string;
    data: any;
}

async function generatorCapturePcap(username: string, password: string, address: string): Promise<void> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

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
        await vero.settings.setGenlockSync({ family: GenlockFamily.genlock30M }, setGenlockTimeoutMs);
        const profiles = await vero.signalGenerator.profiles.getAll();
        interface IProfileIndex {
            index: number;
            name: string;
        }
        // Create array of <index, name>
        const profileIdxNames = profiles.content.map(
            (profile: IGeneratorProfile, index: number): IProfileIndex => ({
                index: index,
                name: profile.meta.description,
            })
        );
        profileIdxNames.forEach((entry: IProfileIndex) => {
            console.log(`${entry.index + 1}\t: ${entry.name}`);
        });
        const profileIndex = (await askForNumber('Choose a profile: ', rl)) - 1;
        // TODO: check if index is valid
        const chosenProfile: IGeneratorProfile = profiles.content[profileIndex];
        // Force redundancy on every sender
        const videos = chosenProfile.senders.video ?? [];
        const audios = chosenProfile.senders.audio ?? [];
        const ancs = chosenProfile.senders.anc ?? [];
        const senders = [...videos, ...audios, ...ancs];
        senders.forEach((item) => (item.network.useRedundancy = true));
        const generatorAwaiter = vero.signalGenerator.makeAwaiter(
            GeneratorChannelId.channel1,
            chosenProfile.id,
            startGeneratorTimeoutMs
        );
        await vero.signalGenerator.start(GeneratorChannelId.channel1, chosenProfile);
        const generatorWaitResult: IGeneratorStatus | undefined = await generatorAwaiter;
        if (!generatorWaitResult) throw new Error('Timeout waiting for the generator to start');
        const activeVideos = generatorWaitResult.video ?? [];
        const activeAudios = generatorWaitResult.audio ?? [];
        const activeAncs = generatorWaitResult.anc ?? [];
        const activeSenders = [...activeVideos, ...activeAudios, ...activeAncs];
        const sourceAddresses = activeSenders.map((item) => ({
            primary: {
                multicastAddress: item.network.primary?.destAddr,
                destinationPort: item.network.primary?.destPort,
            },
            secondary: {
                multicastAddress: item.network.secondary?.destAddr,
                destinationPort: item.network.secondary?.destPort,
            },
        }));
        console.log(JSON.stringify(sourceAddresses));

        if (vero.wsClient) {
            const generatorStatus = await waitForSfpStatus(vero.wsClient, 5000);
            console.log(JSON.stringify(generatorStatus?.sfps_telemetry[0].rx_rate));
        }

        // await vero.capture.selectSource(connectorKind, connectorSourceIndex, connectorSource);
        const activeRateAwaiter = await vero.capture.makeSfpStateAwaiter(getActiveRateCondition(), activeRateTimeoutMs);
        if (!activeRateAwaiter) {
            throw new Error('Timeout waiting for the minimum rate');
        }
        // const captureAwaiter = vero.capture.makeCaptureAwaiter(captureSettings.id, captureCompletionTimeoutMs);
        // await vero.capture.start(captureSettings);
        // const captureResult = await captureAwaiter;
        // if (!captureResult) {
        //     throw new Error('Timeout waiting for the capture to complete');
        // }
        // if (captureResult.state !== CaptureJobState.Completed) {
        //     throw new Error('Capture failed');
        // }
        // if (!captureResult.result?.analysis) {
        //     throw new Error('Pcap doesnt exist');
        // }
    } finally {
        rl.close();
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
