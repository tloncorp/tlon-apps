declare module '*.svg' {
  const content: React.FC<
    React.SVGAttributes<SVGElement> & React.RefAttributes
  >;
  export default content;
}
