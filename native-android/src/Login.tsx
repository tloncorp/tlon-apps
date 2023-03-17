import React, { useCallback, useEffect, useState } from 'react';
import { useTailwind } from 'tailwind-rn/dist';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SHIP_COOKIE_REGEX, URBIT_HOME_REGEX } from './lib/util';
import useStore from './state/store';

const getShipFromCookie = (cookie: string) =>
  cookie.match(SHIP_COOKIE_REGEX)![0].slice(0, -1);

export default function Login() {
  const {
    ships,
    ship,
    shipUrl,
    authCookie,
    addShip,
    clearShip,
    setShipUrl,
    setShip
  } = useStore();
  const tailwind = useTailwind();
  const [shipUrlInput, setShipUrlInput] = useState('');
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [urlProblem, setUrlProblem] = useState<string | null>();
  const [loginProblem, setLoginProblem] = useState<string | null>();
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (shipUrl) {
      fetch(shipUrl)
        .then(async response => {
          const html = await response.text();

          if (URBIT_HOME_REGEX.test(html)) {
            const authCookieHeader =
              response.headers.get('set-cookie') || 'valid';
            if (
              typeof authCookieHeader === 'string' &&
              authCookieHeader?.includes('urbauth-~')
            ) {
              const ship = getShipFromCookie(authCookieHeader);
              addShip({
                ship,
                shipUrl,
                authCookie: authCookieHeader
              });
            }
          } else {
            const stringMatch =
              html.match(/<input value="~.*?" disabled="true"/i) || [];
            const urbitId = stringMatch[0]?.slice(14, -17);
            if (urbitId) addShip({ ship: urbitId, shipUrl });
          }
        })
        .catch(console.error);
    }
  }, [shipUrl]);

  const changeUrl = useCallback(() => {
    clearShip();
  }, []);

  const handleSaveUrl = useCallback(async () => {
    setFormLoading(true);
    // const regExpPattern = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?$/i;
    const leadingHttpRegex =
      /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/i;
    const noPrefixRegex = /^[A-Za-z0-9]+\.([\w#!:.?+=&%@!\-\/])+$/i;

    const prefixedUrl =
      noPrefixRegex.test(shipUrlInput) && !leadingHttpRegex.test(shipUrlInput)
        ? `https://${shipUrlInput}`
        : shipUrlInput;
    const formattedUrl = (
      prefixedUrl.endsWith('/')
        ? prefixedUrl.slice(0, prefixedUrl.length - 1)
        : prefixedUrl
    ).replace('/apps/talk', '');

    if (!formattedUrl.match(leadingHttpRegex)) {
      setUrlProblem('Please enter a valid ship URL.');
    } else {
      let isValid = false;
      const response = await fetch(formattedUrl)
        .then(res => {
          isValid = true;
          return res;
        })
        .catch(console.error);

      if (isValid) {
        setShipUrl(formattedUrl);

        const authCookieHeader = response?.headers.get('set-cookie') || 'valid';
        if (
          typeof authCookieHeader === 'string' &&
          authCookieHeader?.includes('urbauth-~')
        ) {
          // TODO: handle expired auth or determine if auth has already expired
          const ship = getShipFromCookie(authCookieHeader);
          addShip({
            ship,
            shipUrl: formattedUrl,
            authCookie: authCookieHeader
          });
        } else {
          const html = await response?.text();
          if (html) {
            const stringMatch =
              html.match(/<input value="~.*?" disabled="true"/i) || [];
            const ship = stringMatch[0]?.slice(14, -17);
            if (ship) addShip({ ship, shipUrl: formattedUrl });
          }
        }
      } else {
        setUrlProblem(
          'There was an error, please check the URL and try again.'
        );
      }
    }
    setFormLoading(false);
  }, [shipUrlInput, addShip, setUrlProblem]);

  const handleLogin = useCallback(async () => {
    setFormLoading(true);
    const regExpPattern = /^((?:[a-z]{6}-){3}(?:[a-z]{6}))$/i;

    if (!accessKeyInput.match(regExpPattern)) {
      setLoginProblem('Please enter a valid access key.');
    } else {
      setLoginProblem(null);
      const formBody = `${encodeURIComponent('password')}=${encodeURIComponent(
        accessKeyInput
      )}`;

      await fetch(`${shipUrl}/~/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: formBody
      })
        .then(async response => {
          const authCookieHeader = response.headers.get('set-cookie') || '';
          if (!authCookieHeader) {
            setLoginProblem('Please enter a valid access key.');
          } else {
            addShip({
              ship,
              shipUrl,
              authCookie: authCookieHeader
            });
          }
        })
        .catch(err => {
          console.warn('ERROR LOGGING IN');
        });
    }
    setFormLoading(false);
  }, [accessKeyInput, setLoginProblem]);

  if (formLoading) {
    return (
      <View
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const renderContent = () => {
    if (!shipUrl) {
      return (
        <>
          <Text style={styles.label}>Please enter the url of your ship:</Text>
          <TextInput
            style={tailwind(
              'h-10 mt-3 border border-2 border-gray-300 rounded-md px-3 w-full'
            )}
            onChangeText={setShipUrlInput}
            value={shipUrlInput}
            placeholder="http(s)://your-ship.net"
            keyboardType="url"
          />
          {urlProblem && <Text style={{ color: 'red' }}>{urlProblem}</Text>}
          <View style={{ height: 16 }} />
          <Button title="Continue" onPress={handleSaveUrl} />
          <View style={{ height: 16 }} />
        </>
      );
    }
    return (
      <>
        <Text style={styles.label}>Please enter your Access Key:</Text>
        <TextInput
          style={tailwind(
            'h-10 mt-3 border border-2 border-gray-300 rounded-md px-3 w-full'
          )}
          value={ship}
          placeholder="sampel-palnet"
          editable={false}
        />
        <View style={{ position: 'relative' }}>
          <TextInput
            style={tailwind(
              'h-10 mt-3 border border-2 border-gray-300 rounded-md px-3 w-full'
            )}
            onChangeText={setAccessKeyInput}
            value={accessKeyInput}
            placeholder="sampel-ticlyt-migfun-falmel"
            maxLength={27}
            secureTextEntry={!showPassword}
            keyboardType="visible-password"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.showPassword}
          >
            <Text style={styles.showPasswordText}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>
        {loginProblem && <Text style={{ color: 'red' }}>{loginProblem}</Text>}
        <View style={{ height: 8 }} />
        <Button title="Continue" onPress={handleLogin} />
        <View style={{ height: 8 }} />
        <Button title="Log in with a different ID" onPress={changeUrl} />
      </>
    );
  };

  return (
    <View style={tailwind('p-6 h-full')}>
      <View style={tailwind('flex flex-col items-center')}>
        <Text style={tailwind('text-xl p-6 mt-6')}>Talk</Text>
      </View>
      {renderContent()}
      {ships.length > 0 && !authCookie && (
        <>
          <View style={tailwind('h-2')} />
          <Button title="Cancel" onPress={() => setShip(ships[0].ship)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 20,
    margin: 16,
    alignSelf: 'center'
  },
  showPassword: {
    padding: 4,
    position: 'absolute',
    right: 8,
    top: 18,
    color: 'gray'
  },
  showPasswordText: {
    color: 'black'
  }
});
