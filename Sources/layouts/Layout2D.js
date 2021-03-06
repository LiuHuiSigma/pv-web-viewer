import React from 'react';
import PropTypes from 'prop-types';

import { Button } from 'antd';

import vtkSlider from 'vtk.js/Sources/Interaction/UI/Slider';

import style from './vtk-layout.mcss';

const COLOR_BY_AXIS = ['yellow', 'red', 'green'];

export default class Layout2D extends React.Component {
  constructor(props) {
    super(props);

    // Setup vtk.js objects
    this.activeRepresentation = null;
    this.view = props.proxyManager.createProxy('Views', 'View2D');
    this.view.updateOrientation(props.axis, props.orientation, props.viewUp);
    this.subscriptions = [];

    // Slider
    this.slider = vtkSlider.newInstance();
    this.slider.onValueChange((sliceIndex) => {
      if (this.activeRepresentation) {
        this.activeRepresentation.setSliceIndex(Number(sliceIndex));
        this.props.proxyManager.modified();
        this.props.proxyManager.renderAllViews();
      }
    });

    // Bind callbacks
    this.onActiveSourceChange = this.onActiveSourceChange.bind(this);
    this.rotate = this.rotate.bind(this);
    this.toggleOrientationMarker = this.toggleOrientationMarker.bind(this);
    this.updateOrientation = this.updateOrientation.bind(this);
    this.activateView = this.activateView.bind(this);
    this.flush = () => this.forceUpdate();

    // Subscribe bind function
    this.subscriptions = [
      this.props.proxyManager.onActiveSourceChange(this.onActiveSourceChange),
      this.props.proxyManager.onActiveViewChange(this.flush),
    ];

    this.onActiveSourceChange();
  }

  componentDidMount() {
    this.view.setContainer(this.container);
    this.slider.setContainer(this.sliderContainer);

    this.view.resetCamera();
    this.view.resize();
    window.addEventListener('resize', this.view.resize);
    this.view.resetCamera();

    setTimeout(this.view.resize, 500);
  }

  componentWillUnmount() {
    while (this.subscriptions.length) {
      this.subscriptions.pop().unsubscribe();
    }
    if (this.repSubscription) {
      this.repSubscription.unsubscribe();
      this.repSubscription = null;
    }
    window.removeEventListener('resize', this.view.resize);
    this.view.setContainer(null);
    this.props.proxyManager.deleteProxy(this.view);
  }

  onActiveSourceChange() {
    const activeSource = this.props.proxyManager.getActiveSource();
    const newRep = this.props.proxyManager.getRepresentation(
      activeSource,
      this.view
    );
    if (
      this.repSubscription &&
      this.activeRepresentation &&
      this.activeRepresentation !== newRep
    ) {
      this.repSubscription.unsubscribe();
      this.repSubscription = null;
    }
    if (newRep) {
      this.activeRepresentation = newRep;
      this.repSubscription = newRep.onModified(() => {
        if (
          this.activeRepresentation &&
          this.activeRepresentation.getSliceIndex
        ) {
          this.slider.setValue(
            Number(this.activeRepresentation.getSliceIndex())
          );
          this.view.updateCornerAnnotation({
            sliceIndex: this.activeRepresentation.getSliceIndex(),
          });
        }
        if (
          this.activeRepresentation &&
          this.activeRepresentation.getColorWindow
        ) {
          this.view.updateCornerAnnotation({
            colorWindow: Math.round(this.activeRepresentation.getColorWindow()),
            colorLevel: Math.round(this.activeRepresentation.getColorLevel()),
          });
        }
      });
    }
    if (this.activeRepresentation && this.activeRepresentation.getSliceIndex) {
      this.slider.setValues(this.activeRepresentation.getSliceIndexValues());
      this.slider.setValue(Number(this.activeRepresentation.getSliceIndex()));
      this.view.updateCornerAnnotation({
        sliceIndex: this.activeRepresentation.getSliceIndex(),
      });
    }
    if (this.activeRepresentation && this.activeRepresentation.getColorWindow) {
      this.view.updateCornerAnnotation({
        colorWindow: Math.round(this.activeRepresentation.getColorWindow()),
        colorLevel: Math.round(this.activeRepresentation.getColorLevel()),
      });
    }
  }

  updateOrientation(e) {
    const state = this.props.orientations[Number(e.target.dataset.index)];
    this.view.updateOrientation(state.axis, state.orientation, state.viewUp);
    const reps = this.view.getRepresentations();
    for (let i = 0; i < reps.length; i++) {
      if (reps[i].setSlicingMode) {
        reps[i].setSlicingMode('XYZ'[state.axis]);
      }
    }
    this.onActiveSourceChange();
    this.props.proxyManager.modified();
    this.view.resetCamera();
    this.view.renderLater();
    this.onActiveSourceChange();
  }

  rotate() {
    this.view.rotate(90);
  }

  toggleOrientationMarker() {
    const orientationAxes = !this.view.getOrientationAxes();
    this.view.setOrientationAxes(orientationAxes);
    this.view.renderLater();
  }

  activateView() {
    this.props.proxyManager.setActiveView(this.view);
  }

  render() {
    return (
      <div
        className={
          this.props.proxyManager.getActiveView() === this.view
            ? style.activeRenderWindowContainer
            : style.renderWindowContainer
        }
        onClick={this.activateView}
      >
        <div className={style.renderWindowToolbar}>
          <Button
            size="small"
            icon="camera-o"
            onClick={this.view.openCaptureImage}
          />
          <label className={style.renderWindowTitle}>{this.props.title}</label>
          <section className={style.renderWindowActions}>
            {this.props.orientations.map((o, i) => (
              <div
                key={o.label}
                className={style.button}
                data-index={i}
                onClick={this.updateOrientation}
              >
                {o.label}
              </div>
            ))}
            <Button
              size="small"
              icon="global"
              onClick={this.toggleOrientationMarker}
            />
            <Button
              size="small"
              icon="compass"
              onClick={this.rotate}
              style={{ marginRight: '5px' }}
            />
            <Button size="small" icon="scan" onClick={this.view.resetCamera} />
          </section>
        </div>
        <div className={style.splitRow}>
          <div
            className={style.sideBar}
            style={{
              background: COLOR_BY_AXIS[this.view.getAxis()],
              visibility:
                this.activeRepresentation &&
                this.activeRepresentation.getSliceIndex
                  ? 'visible'
                  : 'hidden',
            }}
            ref={(c) => {
              this.sliderContainer = c;
            }}
          />
          <div
            className={`${style.renderWindow} ${this.props.className}`}
            ref={(c) => {
              this.container = c;
            }}
          />
        </div>
      </div>
    );
  }
}

Layout2D.propTypes = {
  proxyManager: PropTypes.object,
  title: PropTypes.string,
  className: PropTypes.string,
  axis: PropTypes.number,
  orientation: PropTypes.number,
  viewUp: PropTypes.array,
  orientations: PropTypes.array,
};

Layout2D.defaultProps = {
  title: 'View 2D',
  proxyManager: null,
  className: '',
  axis: 2,
  orientation: 1,
  viewUp: [0, 1, 0],
  orientations: [
    { label: 'X', axis: 0, orientation: 1, viewUp: [0, 1, 0] },
    { label: 'Y', axis: 1, orientation: 1, viewUp: [1, 0, 0] },
    { label: 'Z', axis: 2, orientation: 1, viewUp: [0, 1, 0] },
  ],
};
