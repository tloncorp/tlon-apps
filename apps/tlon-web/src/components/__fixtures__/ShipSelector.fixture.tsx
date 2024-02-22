import ShipSelector from '@/components/ShipSelector';

export default function ShipSelectorFixture() {
  return (
    <ShipSelector
      ships={[{ label: '~fabled-faster', value: '~fabled-faster' }]}
      setShips={() => null}
    />
  );
}
