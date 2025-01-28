import { patp, patp2bn } from '@urbit/aura';
import { Atom, Cell, Noun, dwim, enjs } from '@urbit/nockjs';

import * as db from '../db';
import { unpackJamBytes } from '../http-api/utils';
import { getCurrentUserId, pokeNoun, scryNoun } from './urbit';

export async function fetchVerifications(): Promise<db.Verification[]> {
  const result = await scryNoun({
    app: 'lanyard',
    path: '/records',
  });
  console.log(`bl: scry result`, result);

  // const tada =
  //   'FaB3vs7sBn+/OQM8cGhvbmWA3kqMjI3MDA5OjMxNHeBDSyMjK3MH/LswN3rjU+C90cFT';
  // // const myBuffer = base64ToArrayBuffer(tada);
  // console.log(`bl: myBuffer`, myBuffer);

  // const hexValues = [
  //   0x15, 0xa0, 0x77, 0xbe, 0xce, 0xec, 0x06, 0x7f, 0xbf, 0x39, 0x03, 0x3c,
  //   0x70, 0x68, 0x6f, 0x6e, 0x65, 0x80, 0xde, 0x4a, 0x8c, 0x8c, 0x8d, 0xcc,
  //   0x0c, 0x0e, 0x4e, 0x8c, 0xcc, 0x4d, 0x1d, 0xe0, 0x43, 0x4b, 0x23, 0x23,
  //   0x2b, 0x73, 0x07, 0xfc, 0xbb, 0x30, 0x37, 0x7a, 0xe3, 0x53, 0xe0, 0xbd,
  //   0xd1, 0xc1, 0x53,
  // ];

  // const abuf = new ArrayBuffer(hexValues.length);
  // const myBuffer = new Uint8Array(abuf);
  // hexValues.forEach((value, index) => {
  //   myBuffer[index] = value;
  // });

  // const theRealBuffer = myBuffer.buffer;
  // const unpacked = await unpackJamBytes(theRealBuffer);
  // console.log(`bl: unpacked`, unpacked);

  // minimum viable unpacking
  const tree = enjs.tree((treeNode: Noun) => {
    if (!(treeNode instanceof Cell)) {
      throw new Error('expected a cell');
    }

    const head = treeNode.head; // pair of ship and identifier
    if (!(head instanceof Cell)) {
      throw new Error('expected a cell');
    }
    const idNoun = head.tail;
    const id = enjs.frond([
      { tag: 'phone', get: (n: Noun) => Atom.cordToString(n as Atom) },
      { tag: 'urbit', get: (n: Noun) => patp((n as Atom).number) },
    ])(idNoun);

    console.log(`bl: id json`, id);

    // if (!(identifier instanceof Cell)) {
    //   throw new Error('expected a cell');
    // }
    // const idType = identifier.head;
    // const idValue = identifier.tail;

    return id;
  })(result as Noun);
  console.log(`whole tree`, tree);
}

// step 1, send %start command
// step 2, resync lanyard state see what changed
// step 3: if good to go, show shiny green check
// step 3b: if bad, prompt for otp

export function initiatePhoneVerify() {
  const phoneNumber = '+13375812665';
  const currentUserId = getCurrentUserId();
  console.log(`getting azimut point`, currentUserId);
  const azimuthPoint = new Atom(BigInt(patp2bn(currentUserId).toString()));
  // const azimuthPoint = new Atom(BigInt('2825991040267835342'));

  console.log(`aura point`, patp2bn(currentUserId));
  console.log(`hand point`, 2825991040267835342n);

  // TAKE 1
  const payload = [
    [null, azimuthPoint],
    ['start', ['phone', phoneNumber]],
  ];

  // TAKE 2
  // const sig = new Atom(BigInt(0));
  // const providerUnit = new Cell(sig, azimuthPoint);
  // const identity = new Cell(
  //   Atom.fromString('phone'),
  //   Atom.fromString(phoneNumber)
  // );
  // const userCommand = new Cell(Atom.fromString('start'), identity);
  // const payload = new Cell(providerUnit, userCommand);

  const noun = dwim(payload);
  console.log(`got the noun`, noun);
  console.log(`got the noun string`, noun.toString());

  return pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
}

export function confirmPhoneVerify(phoneNumber: string, otp: string) {
  // TODO
}

/*
  Take 1 yields:
  "TypeError: Cannot convert BigInt to number\n
    at bitLength (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:161267:13)\n
    at met (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:161780:25)\n
    at mat (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162397:28)\n
    at _jam_in_flat (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162426:16)\n
    at _jam_in (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162434:86)\n
    at _jam_in_pair (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162413:18)\n
    at _jam_in (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162434:46)\n
    at _jam_in_pair (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162415:18)\n
    at _jam_in (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162434:46)\n
    at _jam_in_pair (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162415:18)\n
    at _jam_in (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162434:46)\n
    at _jam_in_pair (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162413:18)\n
    at _jam_in (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162434:46)\n
    at jam (http://192.168.0.180:8082/index.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app:162442:20)\n
    at ?anon_0_
  */
