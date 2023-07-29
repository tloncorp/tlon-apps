import React from 'react';
import cn from 'classnames';
import ReactMarkdown from 'react-markdown';
import {
  HeadingProps as MDHeadProps,
  UnorderedListProps as MDULProps,
  OrderedListProps as MDOLProps,
  CodeProps as MDCodeProps,
  ReactMarkdownProps as MDProps,
  ComponentPropsWithoutRef,
} from 'react-markdown/lib/ast-to-react';


type MDListProps = MDULProps | MDOLProps;
type MDComponentProps<T extends React.ElementType<any>> =
  ComponentPropsWithoutRef<T> & MDProps;


export default function MarkdownBlock({
  content,
  archetype,
  className
}: {
  content: string;
  archetype: "head" | "desc" | "body";
  className?: string;
}) {
  const borderClass: string = "border-solid border-2 border-gray-800";

  const renderHeader = ({node, level, className, ...props}: MDHeadProps) => {
    const levelMap = [
      "",                              // 0
      "text-2xl font-bold",            // 1
      "text-xl font-semibold",         // 2
      "text-lg font-semibold",         // 3
      "underline font-medium italic",  // 4
      "underline font-medium italic",  // 5
      "underline italic",              // 6
    ];
    return (
      <div className={cn(levelMap[level], className)} {...props}/>
    );
  };
  const renderList = ({node, ordered, className, ...props}: MDListProps) => {
    const listType: string = (ordered ? "list-decimal" : "list-disc");
    return (
      <ul className={cn("list-outside ml-[1.15em]", listType, className)} {...props}/>
    );
  };
  const renderParagraph = ({node, className, ...props}: MDComponentProps<"p">) => (
    <p {...props}/>
  );
  const renderLink = ({node, className, ...props}: MDComponentProps<"a">) => (
    <a {...props}/>
  );
  const renderQuote = ({node, className, ...props}: MDComponentProps<"blockquote">) => (
    <blockquote
      className={cn("p-2 bg-gray-200/20 border-l-4 border-gray-800", className)}
      {...props}
    />
  );
  const renderCode = ({node, inline, className, ...props}: MDCodeProps) => (
    <code
      className={cn(
        "rounded bg-blue-soft",
        inline ? "inline-block px-1.5" : "block p-2",
        className
      )}
      {...props}
    />
  );
  const renderImage = ({node, src, alt, className, ...props}: MDComponentProps<"img">) => {
    const {children, ...lprops} = props;
    return (archetype === "body") ?
      (<img {...{src: src, alt: alt, className: cn(borderClass, className), ...props}} />) :
      // @ts-ignore
      renderLink({node: node, href: src, children: alt, className: className, ...lprops});
  };

  return (
    <ReactMarkdown
      skipHtml={true}
      children={content}
      components={{
        a: renderLink,
        img: renderImage,
        code: renderCode,
        // NOTE: This prevents headers from being rendering undesirable
        // subcomponents, e.g. sublinks, quotes, lists, etc.
        ...((archetype === "head") ? {
            p: "div",
            ol: "div", ul: "div",
            blockquote: "div",
          } : {
            h1: renderHeader, h2: renderHeader, h3: renderHeader,
            h4: renderHeader, h5: renderHeader, h6: renderHeader,
            ol: renderList, ul: renderList,
            blockquote: renderQuote,
            p: renderParagraph,
        })
      }}
      className={cn(
        (archetype === "head") ? "underline text-xl" : "",
        (archetype === "body") ? "overflow-x-auto" : "",
        "break-words space-y-2",
        className)}
    />
  );
}
