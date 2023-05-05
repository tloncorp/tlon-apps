import React, { useCallback, useState } from 'react';
import { useTailwind } from 'tailwind-rn/dist';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SHIP_COOKIE_REGEX } from './lib/util';
import useStore from './state/store';
import { preSig } from '@urbit/api';

const LEADING_HTTP_REGEX =
  /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/i;
const NO_PREFIX_REGEX = /^[A-Za-z0-9]+\.([\w#!:.?+=&%@!\-\/])+$/i;
const PLUS_CODE_REGEX = /^((?:[a-z]{6}-){3}(?:[a-z]{6}))$/i;

const getShipFromCookie = (cookie: string) =>
  cookie.match(SHIP_COOKIE_REGEX)![0].slice(0, -1);

const getShipFromHtml = (html: string) => {
  const stringMatch = html.match(/<input value="~.*?" disabled="true"/i) || [];
  return preSig(stringMatch[0]?.slice(14, -17) ?? '');
};

const normalizeShipUrlInput = (url: string) => {
  const prefixedUrl =
    NO_PREFIX_REGEX.test(url) && !LEADING_HTTP_REGEX.test(url)
      ? `https://${url}`
      : url;
  return (
    prefixedUrl.endsWith('/')
      ? prefixedUrl.slice(0, prefixedUrl.length - 1)
      : prefixedUrl
  ).replace('/apps/talk', '');
};

export default function Login() {
  const { setShip } = useStore();
  const tailwind = useTailwind();
  const [shipUrlInput, setShipUrlInput] = useState('');
  const [shipConnection, setShipConnection] = useState({
    ship: '',
    shipUrl: '',
  });
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [urlProblem, setUrlProblem] = useState<string | null>();
  const [loginProblem, setLoginProblem] = useState<string | null>();
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const handleReset = useCallback(() => {
    setShipConnection({
      ship: '',
      shipUrl: '',
    });
  }, []);

  const handleSaveUrl = useCallback(async () => {
    const formattedUrl = normalizeShipUrlInput(shipUrlInput);
    if (formattedUrl.match(LEADING_HTTP_REGEX)) {
      setUrlProblem(null);
      try {
        setFormLoading(true);
        const response = await fetch(formattedUrl);
        const html = await response.text();
        setShipConnection({
          ship: getShipFromHtml(html),
          shipUrl: formattedUrl,
        });
      } catch (err) {
        console.error('Error accessing ship URL', formattedUrl);
        setUrlProblem('Please enter a valid ship URL.');
      }

      setFormLoading(false);
    } else {
      setUrlProblem('Please enter a valid ship URL.');
    }
  }, [shipUrlInput]);

  const handleLogin = useCallback(async () => {
    setFormLoading(true);

    if (accessKeyInput.match(PLUS_CODE_REGEX)) {
      setLoginProblem(null);

      try {
        const response = await fetch(`${shipConnection.shipUrl}/~/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: `password=${accessKeyInput}`,
        });

        const authCookie = response.headers.get('set-cookie');
        if (authCookie) {
          setShip({
            ...shipConnection,
            ship: getShipFromCookie(authCookie),
            authCookie,
          });
        } else {
          setLoginProblem(
            'An error occurred while loggin in. Please try again.'
          );
        }
      } catch (err) {
        console.error('Error validating access key', err);
        setLoginProblem('An error occurred while loggin in. Please try again.');
      }
    } else {
      setLoginProblem('Please enter a valid access key.');
    }

    setFormLoading(false);
  }, [accessKeyInput]);

  if (formLoading) {
    return (
      <View
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const renderContent = () => {
    if (!shipConnection.shipUrl) {
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
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
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
          value={shipConnection.ship}
          placeholder="~sampel-palnet"
          editable={!shipConnection.ship}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
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
            keyboardType={showPassword ? 'visible-password' : 'default'}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
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
        <Button title="Log in with a different ID" onPress={handleReset} />
      </>
    );
  };

  return (
    <View style={tailwind('p-6 h-full')}>
      <View style={tailwind('flex flex-col items-center')}>
        <Text style={tailwind('text-xl p-6 mt-6')}>Talk</Text>
      </View>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 20,
    margin: 16,
    alignSelf: 'center',
  },
  showPassword: {
    padding: 4,
    position: 'absolute',
    right: 8,
    top: 18,
    color: 'gray',
  },
  showPasswordText: {
    color: 'black',
  },
});
