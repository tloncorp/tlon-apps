import JavaScriptCore

class UrbitDateFormatter {
    static func format(inputDate: Date) -> String? {
        let context = JSContext()!
        context.exceptionHandler = { context, exception in
            print("JavaScript Error: \(exception?.toString() ?? "Unknown exception")")
        }
        
        guard let scriptURL = Bundle.main.url(forResource: "bundle", withExtension: "js") else {
            print("Error: bundle.js not found.")
            return nil
        }

        guard let script = try? String(contentsOf: scriptURL) else {
            print("Error: Could not load content of bundle.js.")
            return nil
        }
        
        context.evaluateScript(script)
                let jsValueResult = context.objectForKeyedSubscript("tlon")
                                   .invokeMethod("formatUrbitDateString", withArguments: [
                                    inputDate.javascriptTimestampFloor
                                   ])
        
        guard let resultString = jsValueResult?.toString(),
              jsValueResult?.isString == true else {
            
            print("Error: JS function did not return a valid string.")
            return nil
        }
        
        return resultString
    }
}
