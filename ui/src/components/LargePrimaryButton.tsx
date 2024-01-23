export default function LargePrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  return (
    <button
      className="w-full rounded-lg border border-blue-200 bg-blue-soft px-6 py-4 text-lg font-semibold text-blue active:border-blue-300 active:bg-blue-300 disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-400 dark:border-blue-500 dark:disabled:border-gray-100"
      {...props}
    >
      {props.children}
    </button>
  );
}
