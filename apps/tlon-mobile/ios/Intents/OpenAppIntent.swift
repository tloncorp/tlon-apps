import AppIntents

struct OpenAppIntent: AppIntent {
  static var title: LocalizedStringResource = "Open channel"
  static var description = IntentDescription("Opens the app to the specified channel.")
  static var openAppWhenRun = true
  
  @Parameter(title: "Channel", description: "The app will open to this channel.")
  var channel: ChannelEntity?
  
  @Parameter(title: "Start draft", description: "True if you want to start a new draft in the channel.")
  var startDraft: Bool?
  
  @Dependency
  private var intentNotepad: IntentNotepad
  
  @MainActor
  func perform() async throws -> some IntentResult {
    if let channelId = channel?.id {
      intentNotepad.action = .openChannel(channelId: channelId, startDraft: startDraft ?? false)
    } else {
      intentNotepad.action = nil
    }
    return .result()
  }
}
