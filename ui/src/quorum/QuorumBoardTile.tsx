import React, { ReactElement, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import _ from 'lodash';
import cn from 'classnames';
import { darken, hsla, lighten, parseToHsla, readableColorIsBlack } from 'color2k';
import { HamburgerMenuIcon } from '@radix-ui/react-icons';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { foregroundFromBackground } from '@/components/Avatar';
import BulletIcon from '@/components/icons/BulletIcon';
import { getFlagParts, isColor, getDarkColor, disableDefault, handleDropdownLink } from '@/logic/utils';
import { useCurrentTheme } from '@/state/local';
import { useIsMobile } from '@/logic/useMedia';
import { BoardMeta, QuorumBrief } from '@/types/quorum';
import { Group } from '@/types/groups';


export function QuorumBoardTile({
  board,
  group: g,
  brief: b,
  className,
}: {
  board: BoardMeta;
  group?: Group;
  brief?: QuorumBrief;
  className?: string;
}) {
  const group = g || {meta: {title: "", cover: "0x0"}};
  const brief: QuorumBrief = b || {last: 0, count: 0};
  const defaultImportCover = group.meta.cover === "0x0";
  // TODO: Consider using 'suspend*Color' variables for stale boards
  // (i.e. those from which the current ship hasn't recently received
  // updates).
  const {lightText, tileColor, menuColor/*, suspendColor, suspendMenuColor*/} =
    useTileColor(isColor(group.meta.cover) ? group.meta.cover : "black");

  // NOTE: Styles are used here instead of custom TailwindCSS classes because
  // the latter cannot handle dynamic values, e.g. `bg-[${group.meta.cover}]`
  const bgStyle = () => (
    (!isColor(group.meta.cover) && !defaultImportCover)
      ? {
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundImage: `url(${group.meta.cover})`
      } : (isColor(group.meta.cover) && !defaultImportCover)
        ? {backgroundColor: tileColor}
        : {}
  );
  const fgStyle = () => {
    const fg = foregroundFromBackground(group?.meta.cover);
    const co = (c: string): string => `rgb(var(--colors-${c}))`
    return (!isColor(group.meta.cover) && !defaultImportCover)
      ? {
          color: co("white"),
          textShadow: `2px 2px 3px ${co("black")}`,
      } : (isColor(group.meta.cover) && !defaultImportCover)
        ? (fg === "white")
          ? {color: co("gray-50")}
          : {color: co("gray-800")}
      : {color: co(fg)}
  };

  return (
    <Link to={`/channel/${board.group}/${board.board}`}
        className={cn(
          "group absolute h-full w-full font-semibold overflow-hidden",
          "default-ring ring-gray-400 rounded-3xl focus-visible:ring-8",
          _.isEmpty(bgStyle()) && "bg-gray-400",
        )}
        style={bgStyle()}
    >

      {(brief.count > 0) && (
        <div className="absolute top-3 left-3 z-10 sm:top-5 sm:left-5">
          <div className={cn(
            "absolute w-8 h-8",
            "animate-pulse rounded-full bg-blue-400 opacity-10",
            "sm:top-0 sm:left-0",
          )} />
          <BulletIcon className="w-8 h-8 text-blue-400" />
        </div>
      )}
      <BoardTileMenu
        board={board}
        menuColor={menuColor}
        lightText={lightText}
        className={cn(
          "absolute top-3 right-3 z-10 opacity-0",
          "focus:opacity-100 group-hover:opacity-100",
          "pointer-coarse:opacity-100 hover-none:opacity-100 sm:top-5 sm:right-5"
        )}
      />
      <div
        className={cn(
          "h4 absolute bottom-[8%] left-[5%] z-10 rounded-lg sm:bottom-7 sm:left-5"
        )}
        style={fgStyle()}
      >
        {`${group.meta.title} • ${board.title}`}
      </div>
    </Link>
  );
}

const BoardTileMenuItem = React.forwardRef<HTMLDivElement, DropdownMenu.MenuItemProps>(
  ({ children, ...props }, ref) => (
    <DropdownMenu.Item
      ref={ref}
      {...props}
      className="default-ring block w-full select-none rounded leading-none mix-blend-hard-light ring-gray-600"
    >
      {children}
    </DropdownMenu.Item>
  )
);

function BoardTileMenu({
  board,
  menuColor,
  lightText,
  className
}: {
  board: BoardMeta;
  menuColor: string;
  lightText: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const {ship: boardShip, name: boardName} = getFlagParts(board.board);
  const menuBg = { backgroundColor: menuColor };
  const linkOnSelect = useCallback(handleDropdownLink(setOpen), []);
  const isMobile = useIsMobile();

  return (
    <DropdownMenu.Root open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DropdownMenu.Trigger
        className={cn(
          "default-ring flex h-8 w-8 items-center justify-center rounded-full transition-opacity duration-75",
          open && "opacity-100",
          className
        )}
        style={menuBg}
        // onMouseOver={() => queryClient.setQueryData(["apps", name], app)}
      >
        <HamburgerMenuIcon
          className={cn(
            "h-4 w-4 mix-blend-hard-light",
            lightText && "text-gray-100"
          )}
        />
        <span className="sr-only">Menu</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          onCloseAutoFocus={disableDefault}
          className={cn(
            "dropdown z-40 py-2 font-semibold",
            lightText ? "text-gray-100" : "text-gray-800"
          )}
          style={menuBg}
        >
          {/* FIXME: Uncomment this when meta dialog exists. */}
          {/*<DropdownMenu.Group>
            <BoardTileMenuItem
              onSelect={isMobile ? (e) => e.preventDefault() : linkOnSelect}
              asChild
            >
              <Link
                to={`/meta/${boardShip}/${boardName}`}
                className="block w-full px-4 py-3"
              >
                Board Info
              </Link>
            </BoardTileMenuItem>
          </DropdownMenu.Group>
          <DropdownMenu.Separator
            className="my-2 border-t-2 border-solid border-gray-600 mix-blend-soft-light"
          />*/}
          <DropdownMenu.Group>
            <BoardTileMenuItem
              asChild
              onSelect={isMobile ? (e) => e.preventDefault() : linkOnSelect}
            >
              <Link
                to={`/destroy/${boardShip}/${boardName}`}
                state={{backgroundLocation: location}}
                className="block w-full px-4 py-3"
              >
                {(boardShip === window.our) ? "Delete" : "Leave"} Board
              </Link>
            </BoardTileMenuItem>
          </DropdownMenu.Group>
          <DropdownMenu.Arrow
            className="h-[10px] w-4 fill-current"
            style={{ color: menuColor }}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function bgAdjustedColor(color: string, darkBg: boolean): string {
  return darkBg ? lighten(color, 0.1) : darken(color, 0.1);
}

function getMenuColor(color: string, darkBg: boolean): string {
  const hslaColor = parseToHsla(color);
  const satAdjustedColor = hsla(
    hslaColor[0],
    Math.max(0.2, hslaColor[1]),
    hslaColor[2],
    1
  );

  return bgAdjustedColor(satAdjustedColor, darkBg);
}

// makes tiles look broken because they blend into BG
function disallowWhiteTiles(color: string): string {
  const hslaColor = parseToHsla(color);
  return hslaColor[2] >= 0.95 ? darken(color, hslaColor[2] - 0.95) : color;
}

export const useTileColor = (color: string) => {
  const theme = useCurrentTheme();
  const darkTheme = theme === "dark";
  const allowedColor = disallowWhiteTiles(color);
  const tileColor = darkTheme ? getDarkColor(allowedColor) : allowedColor;
  const darkBg = !readableColorIsBlack(tileColor);
  const lightText = darkBg !== darkTheme; // if not same, light text
  const suspendColor = darkTheme ? "rgb(26,26,26)" : "rgb(220,220,220)";

  return {
    theme,
    tileColor,
    menuColor: getMenuColor(tileColor, darkBg),
    suspendColor,
    suspendMenuColor: bgAdjustedColor(suspendColor, darkTheme),
    lightText,
  };
};
