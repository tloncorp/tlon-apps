import { useSelect } from 'react-cosmos/client';

const longSampleText =
  'Emerald swifts are diurnal, arboreal lizards. In the early morning they forage for insects, and then spend much of the day basking in the sun. They will retreat to a burrow, or under a rock or log if the temperature becomes too high or to sleep. Their life spans are believed to be between three and five years. Unlike most iguanid lizards, emerald swifts are ovoviviparous, giving birth to six to fifteen young yearly.';

export default function Typography() {
  const sizes = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'];
  const [weight] = useSelect('Font Weight', {
    defaultValue: 'normal',
    options: ['normal', 'medium', 'semibold', 'bold'],
  });
  // Seem to be the text colors in current usage
  const [color] = useSelect('Color', {
    defaultValue: 'black',
    options: [
      'black',
      'blue',
      'gray-50',
      'gray-60',
      'green-500',
      'red-500',
      'yellow-400',
    ],
  });

  return (
    <div>
      {sizes.map((s) => (
        <div key={s} className="mb-5">
          <label className={'mb-1 text-sm text-gray-400'}>text-{s}</label>
          <p className={`text-${s} text-${color} font-${weight}`}>
            {longSampleText}
          </p>
        </div>
      ))}
    </div>
  );
}
