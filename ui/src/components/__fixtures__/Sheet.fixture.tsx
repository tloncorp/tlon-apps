import Sheet, { SheetContent } from '@/components/Sheet';

export default function SettingsDialogFixture() {
  return (
    <Sheet open={true}>
      <SheetContent>
        <div>Here's the sheet!</div>
      </SheetContent>
    </Sheet>
  );
}
