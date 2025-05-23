import React, { ReactNode, memo } from 'react';
import { isEqual } from 'lodash';
import { v1 as random } from 'uuid';
import { safeComponentList } from './SafeComponentList';
import { TemplateRendererComponent, TemplateRendererInput } from './types';
import Text from '../../../component-library/components/Texts/Text';
import { isValidElementName } from '../../Views/confirmations/legacy/components/Approval/TemplateConfirmation/util';

interface TemplateRendererProps {
  sections?: TemplateRendererInput;
}

function getElement(
  section: TemplateRendererComponent,
  // TODO: Replace "any" with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): React.ComponentType<any> {
  const component = section?.element;
  if (!component || !isValidElementName(component)) {
    throw new Error(
      `${component} is not in the safe component list for template renderer`,
    );
  }
  return safeComponentList[component];
}

function renderElement(section: TemplateRendererComponent) {
  const Element = getElement(section);
  const propsAsComponents = section.propComponents
    ? getPropComponents(section.propComponents)
    : {};
  return (
    <Element {...section.props} {...propsAsComponents}>
      {typeof section.children === 'object' ? (
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        <TemplateRenderer sections={section.children} />
      ) : (
        section.children
      )}
    </Element>
  );
}

function getPropComponents(
  components: Record<string, TemplateRendererComponent>,
) {
  return Object.entries(components).reduce<Record<string, ReactNode>>(
    (accumulator, [key, component]) => {
      if (component) {
        accumulator[key] = Array.isArray(component)
          ? component.map(renderElement)
          : renderElement(component);
      }
      return accumulator;
    },
    {},
  );
}

const TemplateRenderer = ({ sections }: TemplateRendererProps) => {
  if (!sections) {
    // If sections is null eject early by returning null
    return null;
  } else if (typeof sections === 'string') {
    // React native can't render strings directly, so adding Text element
    return <Text key={random()}>{sections}</Text>;
  } else if (
    sections &&
    typeof sections === 'object' &&
    !Array.isArray(sections)
  ) {
    return renderElement(sections);
  }

  // The last case is dealing with an array of objects
  return (
    <>
      {sections.reduce<ReactNode[]>(
        (
          allChildren: ReactNode[],
          child: string | TemplateRendererComponent,
        ) => {
          if (typeof child === 'string') {
            // React native can't render strings directly, so push them into the accumulator
            allChildren.push(<Text key={random()}>{child}</Text>);
          } else {
            // If the entry in array is not a string, then it must be a Section.
            // Sections are handled by the main function, but must
            // be provided a key when a part of an array.
            if (!child.key) {
              throw new Error(
                'When using array syntax in MetaMask Template Language, you must specify a key for each child of the array',
              );
            }
            if (typeof child?.children === 'object') {
              // If this child has its own children, check if children is an
              // object, and in that case use recursion to render.
              allChildren.push(
                <TemplateRenderer sections={child} key={child.key} />,
              );
            } else {
              // Otherwise render the element.
              const Element = getElement(child);
              const propsAsComponents = child.propComponents
                ? getPropComponents(child.propComponents)
                : {};
              allChildren.push(
                <Element
                  key={child.key}
                  {...child.props}
                  {...propsAsComponents}
                >
                  {child?.children}
                </Element>,
              );
            }
          }
          return allChildren;
        },
        [],
      )}
    </>
  );
};

export default memo(TemplateRenderer, (prevProps, nextProps) =>
  isEqual(prevProps.sections, nextProps.sections),
);
