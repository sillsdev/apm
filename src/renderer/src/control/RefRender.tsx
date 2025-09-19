import { FC, memo } from 'react';
import { PassageTypeEnum } from '../model/passageType';
import {
  BookIcon,
  ChapterNumberIcon,
  AltBookIcon,
  NoteIcon,
  MovementIcon,
} from './PlanIcons';
import { Typography } from '@mui/material';
import { passageTypeFromRef } from './passageTypeFromRef';

/**
 * Renders a JSX element based on the provided parameters.
 * If the length of the `value` parameter is less than or equal to the length
 * of `type` plus one, it returns the `icon` parameter.
 * Otherwise, it returns a JSX element that includes the `icon` parameter, a
 * non-breaking space character, and a substring of the `value` parameter
 * starting from the length of `type`.
 *
 * @param value - The value to be rendered.
 * @param type - The type of the passage.
 * @param Icon - The icon component to be rendered.
 * @returns The rendered output, which includes the `icon` parameter, a
 * non-breaking space character, and a substring of the `value` parameter.
 */
interface AtProps {
  value: any;
  type: PassageTypeEnum;
  Icon: JSX.Element;
  fontSize?: string;
}

const ArgType: FC<AtProps> = memo(
  ({ value, type, Icon, fontSize }: AtProps) => {
    const len = type !== PassageTypeEnum.PASSAGE ? type.length : -1;
    const val = String(value).substring(len + 1);

    return (
      <>
        <Typography
          component={'span'}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '200px',
            ...(fontSize && { fontSize }),
          }}
        >
          {Icon}
          {'\u00A0'}
          {val}
        </Typography>
      </>
    );
  }
);

ArgType.displayName = 'ArgType';

/**
 * Determines the passage type based on the input value and returns the
 * corresponding icon component.
 *
 * @param value - The value used to determine the passage type.
 * @param flat - A flag indicating whether the value should be treated as a flat passage.
 * @returns The corresponding icon component based on the passage type.
 */
interface IPtMap {
  [key: string]: JSX.Element;
}
const passageTypeMap: IPtMap = {
  [PassageTypeEnum.MOVEMENT]: MovementIcon,
  [PassageTypeEnum.CHAPTERNUMBER]: ChapterNumberIcon,
  [PassageTypeEnum.BOOK]: BookIcon,
  [PassageTypeEnum.ALTBOOK]: AltBookIcon,
  [PassageTypeEnum.NOTE]: NoteIcon,
};
interface IProps {
  value: string;
  pt: PassageTypeEnum;
  fontSize?: string;
}

export const RefRender: FC<IProps> = memo(({ value, pt, fontSize }: IProps) => {
  return (
    <ArgType
      value={value}
      type={passageTypeFromRef(value)}
      Icon={passageTypeMap[pt] || <></>}
      fontSize={fontSize}
    />
  );
});

RefRender.displayName = 'RefRender';
