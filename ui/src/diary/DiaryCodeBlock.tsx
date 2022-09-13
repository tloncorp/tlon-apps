import { lowlight } from 'lowlight/lib/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import './DiaryCodeBlock.css';

const DiaryCodeBlock = CodeBlockLowlight.configure({ lowlight });

export default DiaryCodeBlock;
