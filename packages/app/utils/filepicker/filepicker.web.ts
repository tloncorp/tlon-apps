import { PickFile } from './types';

export const pickFile: PickFile = () => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();

    input.onerror = reject;
    input.onchange = async () => {
      console.log('input.onchange');
      if (input.files) {
        resolve(
          Array.from(input.files).map((file) => ({
            type: 'file',
            file,
          }))
        );
      }
      document.body.removeChild(input);
    };
  });
};
