Pod::Spec.new do |s|
  s.name           = 'TlonNoteBodyInput'
  s.version        = '1.0.0'
  s.summary        = 'Native note body input for Tlon Messenger'
  s.description    = 'A UITextView for the notes editor with an extensible edit menu and image paste.'
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
