import { patp2bn } from '@urbit/aura';
import { Atom, dwim } from '@urbit/nockjs';

import { getCurrentUserId, pokeNoun } from './urbit';

export function initiatePhoneVerify(phoneNumber: string) {
  const currentUserId = getCurrentUserId();
  console.log(`getting azimut point`, currentUserId);
  const azimuthPoint = new Atom(patp2bn(currentUserId));
  // const azimuthPoint = new Atom(BigInt('2825991040267835342'));

  // TAKE 1
  const payload = [
    [null, azimuthPoint],
    ['start', ['phone', phoneNumber]],
  ];

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

  return pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
}

export function confirmPhoneVerify(phoneNumber: string, otp: string) {
  // TODO
}
