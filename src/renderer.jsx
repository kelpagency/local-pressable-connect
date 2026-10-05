import PressableConnect from './PressableConnect';

export default function (context) {
  const {hooks} = context;
  hooks.addFilter('siteInfoToolsItem', (menu) => [
    ...menu,
    {menuItem: 'Pressable Connect', path: '/pressable-connect', render: (props) => <PressableConnect {...props} />},
  ]);
}
