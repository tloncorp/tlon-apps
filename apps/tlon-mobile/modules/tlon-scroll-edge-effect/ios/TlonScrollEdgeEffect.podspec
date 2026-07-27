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

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
