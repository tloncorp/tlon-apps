import { BigIntOrderedMap } from "@urbit/api";
import { Chat, ChatWrit } from "../../types/chat";

export interface ChatScrollerProps {
  chat?: Chat;
  messages: BigIntOrderedMap<ChatWrit>;
  replying?: string | null;
}
