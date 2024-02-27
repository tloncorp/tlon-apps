package io.tlon.landscape.utils;

import java.math.BigInteger;

public class UvParser {
    private static final String uvAlphabet = "0123456789abcdefghijklmnopqrstuv";

    public static BigInteger parseUv(String x) {
        BigInteger res = BigInteger.ZERO;
        x = x.substring(2).toLowerCase();
        while (!x.isEmpty()) {
            if (x.charAt(0) != '.') {
                res = res.shiftLeft(5).add(BigInteger.valueOf(uvAlphabet.indexOf(x.charAt(0))));
            }
            x = x.substring(1);
        }
        return res;
    }

    public static int getLastDigitsAsInt(BigInteger bigInt, int numDigits) {
        BigInteger moduloValue = BigInteger.TEN.pow(numDigits);
        BigInteger result = bigInt.mod(moduloValue);
        return result.intValue();
    }

    public static int getIntCompatibleFromUv(String x) {
        return getLastDigitsAsInt(parseUv(x), 9);
    }
}
