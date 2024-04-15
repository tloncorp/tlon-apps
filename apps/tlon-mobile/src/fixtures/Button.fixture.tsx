import { Button } from '@tloncorp/ui';

export default {
  primary: () => (
    <Button>
      <Button.Text>Primary</Button.Text>
    </Button>
  ),
  text: () => (
    <Button minimal>
      <Button.Text>Text Button</Button.Text>
    </Button>
  ),
};
