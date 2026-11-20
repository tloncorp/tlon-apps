Pod::Spec.new do |s|
  s.name           = 'TlonNotePreview'
  s.version        = '1.0.0'
  s.summary        = 'Native note preview for Tlon Messenger'
  s.description    = 'A selectable rendered note on TextKit 2, with images, tables and code inline.'
  s.author         = 'Tlon'
  s.homepage       = 'https://tlon.io'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'SDWebImage'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
