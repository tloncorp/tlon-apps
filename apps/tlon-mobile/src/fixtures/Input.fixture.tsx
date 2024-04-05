import { Icon, View } from '@tloncorp/ui';
import { Input } from '@tloncorp/ui/src/components/Input';
import { SearchBar } from '@tloncorp/ui/src/components/SearchBar';

const Container = ({ children }: { children: React.ReactNode }) => (
  <View flex={1} paddingTop="$3xl" paddingHorizontal="$2xl">
    {children}
  </View>
);

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
  Search: () => (
    <Container>
      <SearchBar size="$m" onChangeQuery={() => {}} />
    </Container>
  ),
};
