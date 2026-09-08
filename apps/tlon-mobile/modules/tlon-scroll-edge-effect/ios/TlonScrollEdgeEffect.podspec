unless defined?(install_modules_dependencies)
  require File.expand_path('../../../../../node_modules/react-native/scripts/react_native_pods', __dir__)
end

Pod::Spec.new do |s|
  s.name           = 'TlonScrollEdgeEffect'
  s.version        = '1.0.0'
  s.summary        = 'Native scroll-edge integration for floating Tlon controls'
  s.description    = 'Connects floating conversation controls to the native iOS scroll edge effect.'
  s.author         = 'Tlon'
  s.homepage       = 'https://github.com/tloncorp/landscape-apps'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: 'https://github.com/tloncorp/landscape-apps.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'RNScreens'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
  }

  # This provider imports the supported Fabric ScrollView/Paragraph APIs.
  # Use RN's module configuration so framework builds get the matching C++
  # flags and transitive header paths instead of relying on ambient headers.
  install_modules_dependencies(s)
  add_dependency(s, 'React-FabricComponents', additional_framework_paths: [
    'react/renderer/textlayoutmanager/platform/ios',
  ])

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  s.exclude_files = "tests/**/*"
end
