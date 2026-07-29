Pod::Spec.new do |s|
  s.name           = 'TlonMessageContextMenu'
  s.version        = '1.0.0'
  s.summary        = 'Native message context menu for Tlon Messenger'
  s.description    = 'A native iOS message preview, reaction bar, and action menu.'
  s.author         = 'Tlon'
  s.homepage       = 'https://tlon.io'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
