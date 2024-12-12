import { patp2bn } from '@urbit/aura';
import { Atom, dwim } from '@urbit/nockjs';

import { getCurrentUserId, pokeNoun, scryNoun } from './urbit';

export async function getSelfVerificationStatus() {
  const result = await scryNoun({
    app: 'lanyard',
    path: '/records',
  });
  console.log(`bl: scry result`, result);
}

// step 1, send %start command
// step 2, resync lanyard state see what changed
// step 3: if good to go, show shiny green check
// step 3b: if bad, prompt for otp

export function initiatePhoneVerify(phoneNumber: string) {
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
