import React, {
  ChangeEvent,
  KeyboardEvent,
  useState,
  useEffect,
  useCallback,
} from 'react';
import cn from 'classnames';
import { useNavigate, useParams } from "react-router-dom";
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useBoardFlag, useBoardMeta } from '@/state/quorum';
import { useAnchorNavigate } from '@/logic/routing';
import { encodeQuery, decodeQuery } from '@/logic/quorum-utils';


export default function QuorumNav({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [query, setQuery] = useState<string>("");

  const params = useParams();
  const anchorNavigate = useAnchorNavigate();

  const boardFlag = useBoardFlag();
  const board = useBoardMeta(boardFlag);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const {value}: {value: string;} = event.target;
    setQuery(value);
  }, [query]);
  const submitQuery = useCallback(() => {
    if (query !== "") {
      anchorNavigate(`search/${encodeQuery(query)}`);
    }
  }, [anchorNavigate, query]);
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitQuery();
    }
  }, [submitQuery]);
  const onSubmit = useCallback(() => {
    submitQuery();
  }, [submitQuery]);

  useEffect(() => {
    if (params?.query) {
      setQuery(decodeQuery(params.query));
    }
  }, [params.query]);

  return (
    <nav className={cn(className, "w-full sticky top-0 z-20 p-2")}>
      <div className="flex flex-row gap-2">
        {children}
        <label className="relative flex w-full items-center">
          <span className="sr-only">Search Prefences</span>
          <span className={cn(
            "absolute inset-y-[5px] left-0 h-8 w-8",
            "flex items-center pl-2",
            "text-gray-400"
          )}>
            <MagnifyingGlassIcon
              className="h-4 w-4"
              style={{transform: "rotateY(180deg)"}}
            />
          </span>
          <input
            className={cn(
              "input h-10 w-full bg-gray-50 pl-7 text-sm",
              "placeholder:font-normal focus-within:mix-blend-normal md:text-base",
            )}
            placeholder={`Search ${
              (boardFlag === "") ? "All Boards"
                : (board === undefined) ? "...loading..."
                  : `'${board.title}'`
            }`}
            value={query}
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
        </label>
      </div>
    </nav>
  );
}
