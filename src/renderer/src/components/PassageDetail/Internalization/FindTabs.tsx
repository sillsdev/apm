import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import {
  Badge,
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FindOther from './FindOther';
import CreateAiRes from './CreateAiRes';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { ReactNode, useEffect, useState, SyntheticEvent } from 'react';
import { LaunchLink } from '../../../control/LaunchLink';
import { AltButton } from '../../../control';
import { BibleResource } from '../../../model/bible-resource';
import { IFindResourceStrings, ISharedStrings } from '../../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { findResourceSelector, sharedSelector } from '../../../selector';
import FindAquifer from './FindAquifer';
import FindBibleBrain from './FindBibleBrain';
import FaithbridgeIframe from './FaithbridgeIframe';
import { Aquifer, FaithBridge } from '../../../assets/brands';
import { useHandleLink } from './addLinkKind';

export interface OptionProps {
  label: string;
  value: string;
}

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

interface FindTabsProps {
  onClose?: () => void;
  canAdd: boolean;
  onMarkdown: (query: string, audioUrl: string, transcript: string) => void;
}

export default function FindTabs({
  onClose,
  canAdd,
  onMarkdown,
}: FindTabsProps) {
  const [value, setValue] = useState(0);
  const [selectedValue, setSelectedValue] = useState(0);
  const { passage } = usePassageDetailContext();
  const [aquifer, setAquifer] = useState(true);
  const [resources, setResources] = useState<BibleResource[]>([]);
  const [link, setLink] = useState<string>();
  const handleLink = useHandleLink({ passage, setLink });
  const t: IFindResourceStrings = useSelector(
    findResourceSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const bibleBrainTabIndex = 0;
  const faithBridgeTabIndex = 1;
  const createTabIndex = 2;
  const aquiferTabIndex = 3;
  const findOtherTabIndex = aquifer ? 4 : 3;

  useEffect(() => {
    import('../../../assets/bible-resource').then((module) => {
      setResources(module.default);
    });
  }, []);

  useEffect(() => {
    setAquifer(canAdd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdd]);

  const handleChange = (event: SyntheticEvent, newValue: number) => {
    setValue(newValue);
    setSelectedValue(newValue);
  };

  const handleSelectChange = (event: SelectChangeEvent<number>) => {
    setSelectedValue(Number(event.target.value));
  };

  const handleLaunchSelectedTab = () => {
    setValue(selectedValue);
  };

  const handleSetTab = (tab: number) => {
    setValue(tab);
    setSelectedValue(tab);
  };

  return (
    <Box
      sx={{
        width: '100%',
        ...(isSmallScreen
          ? {
              display: 'flex',
              flexDirection: 'column',
              minHeight: '70vh',
              maxHeight: '70vh',
              overflow: 'hidden',
            }
          : {}),
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {isSmallScreen ? (
          <FormControl fullWidth size="small" sx={{ my: 1 }}>
            <Select<number>
              value={selectedValue}
              onChange={handleSelectChange}
              displayEmpty
              aria-label={t.findResource}
              sx={{ fontSize: (theme) => theme.typography.h6.fontSize }}
            >
              <MenuItem
                value={bibleBrainTabIndex}
                sx={{ fontSize: (theme) => theme.typography.h6.fontSize }}
              >
                Bible Brain
              </MenuItem>
              <MenuItem
                value={faithBridgeTabIndex}
                sx={{ fontSize: (theme) => theme.typography.h6.fontSize }}
              >
                {`${FaithBridge} (${ts.ai})`}
              </MenuItem>
              <MenuItem
                value={createTabIndex}
                sx={{ fontSize: (theme) => theme.typography.h6.fontSize }}
              >
                {`${t.create} (${ts.ai})`}
              </MenuItem>
              {aquifer && (
                <MenuItem
                  value={aquiferTabIndex}
                  sx={{ fontSize: (theme) => theme.typography.h6.fontSize }}
                >
                  {t.findBrandedContent.replace('{0}', Aquifer)}
                </MenuItem>
              )}
              <MenuItem
                value={findOtherTabIndex}
                sx={{ fontSize: (theme) => theme.typography.h6.fontSize }}
              >
                {aquifer ? t.findOther : t.findResource}
              </MenuItem>
            </Select>
          </FormControl>
        ) : (
          <Tabs
            value={value}
            onChange={handleChange}
            aria-label="basic tabs example"
          >
            <Tab label="Bible Brain" {...a11yProps(bibleBrainTabIndex)} />
            <Tab
              label={<Badge badgeContent={ts.ai}>{FaithBridge}</Badge>}
              {...a11yProps(faithBridgeTabIndex)}
            />
            <Tab
              label={<Badge badgeContent={ts.ai}>{t.create}</Badge>}
              {...a11yProps(createTabIndex)}
            />
            {aquifer && (
              <Tab
                label={t.findBrandedContent.replace('{0}', Aquifer)}
                {...a11yProps(aquiferTabIndex)}
              />
            )}
            <Tab
              label={aquifer ? t.findOther : t.findResource}
              {...a11yProps(findOtherTabIndex)}
            />
          </Tabs>
        )}
      </Box>
      <Box
        sx={
          isSmallScreen
            ? {
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: aquifer && value === aquiferTabIndex ? 'auto' : 'hidden',
              }
            : {}
        }
      >
        <CustomTabPanel value={value} index={bibleBrainTabIndex}>
          <FindBibleBrain
            handleLink={handleLink}
            onClose={onClose}
            closeRequested={false}
          />
        </CustomTabPanel>
        <CustomTabPanel value={value} index={faithBridgeTabIndex}>
          <FaithbridgeIframe onMarkdown={onMarkdown} onClose={onClose} />
        </CustomTabPanel>
        <CustomTabPanel value={value} index={createTabIndex}>
          <CreateAiRes resources={resources} onTab={() => handleSetTab(faithBridgeTabIndex)} />
        </CustomTabPanel>
        {aquifer && (
          <CustomTabPanel value={value} index={aquiferTabIndex}>
            <FindAquifer onClose={onClose} />
          </CustomTabPanel>
        )}
        <CustomTabPanel value={value} index={findOtherTabIndex}>
          <FindOther handleLink={handleLink} resources={resources} />
        </CustomTabPanel>
      </Box>
      {isSmallScreen && (
        <Box
          sx={{
            flexShrink: 0,
            py: 1,
            px: 1,
            backgroundColor: 'background.paper',
            display: 'flex',
            justifyContent: 'center',
            borderTop: 1,
            borderColor: 'divider',
            boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.12)',
          }}
        >
          <AltButton dark elevated onClick={handleLaunchSelectedTab}
            sx={{ width: '20%', backgroundColor: 'black', color: 'white', justifyContent: 'center' }}>
            {t.launch}
          </AltButton>
        </Box>
      )}
      <LaunchLink url={link} reset={() => setLink('')} />
    </Box>
  );
}
