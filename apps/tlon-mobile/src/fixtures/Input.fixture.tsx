import { Icon } from '@tloncorp/ui';
import { Input } from '@tloncorp/ui/src/components/Input';

export default {
  ['Basic']: () => (
    <Input size="$m">
      <Input.Area placeholder="Enter details..." />
    </Input>
  ),
  ['With Left Icon']: () => (
    <Input>
      <Input.Icon>
        <Icon type="Face" />
      </Input.Icon>
      <Input.Area placeholder="Find pal" />
    </Input>
  ),
};
