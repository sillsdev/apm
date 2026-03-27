import { useState } from 'react';
import { useContext } from 'react';
import { PassageDetailContextMobile } from './PassageDetailContextMobile';

const usePassageDetailContextMobile = () => {
  const { state } = useContext(PassageDetailContextMobile);
  const [filter, setFilter] = useState(false);

  return {
    ...state,
    filter,
    setFilter,
    index: state?.index ?? 0,
    selected: state?.selected ?? '',
  };
};

export default usePassageDetailContextMobile;
