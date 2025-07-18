import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import styles from './HeightMapVisualizer.styl';

class HeightMapVisualizer extends PureComponent {
  static propTypes = {
    heightMapData: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
    gridSizeX: PropTypes.number,
    gridSizeY: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number
  };

  static defaultProps = {
    heightMapData: [],
    gridSizeX: 3,
    gridSizeY: 3,
    width: 300,
    height: 200
  };

  canvasRef = React.createRef();

  componentDidMount() {
    this.drawHeightMap();
  }

  componentDidUpdate() {
    this.drawHeightMap();
  }

  getColorForHeight = (height, minHeight, maxHeight) => {
    if (minHeight === maxHeight) {
      return 'rgb(128, 128, 128)'; // Gray for flat surface
    }
    
    // Normalize height to 0-1 range
    const normalized = (height - minHeight) / (maxHeight - minHeight);
    
    // Create color gradient from blue (low) to red (high)
    const red = Math.floor(255 * normalized);
    const blue = Math.floor(255 * (1 - normalized));
    const green = Math.floor(128 * (1 - Math.abs(normalized - 0.5) * 2));
    
    return `rgb(${red}, ${green}, ${blue})`;
  };

  drawHeightMap = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { heightMapData, gridSizeX, gridSizeY, width, height } = this.props;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!heightMapData || heightMapData.length === 0) {
      // Draw placeholder
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No height map data', width / 2, height / 2);
      return;
    }

    // Find min and max heights
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    
    heightMapData.forEach(row => {
      row.forEach(height => {
        if (height !== null && height !== undefined) {
          minHeight = Math.min(minHeight, height);
          maxHeight = Math.max(maxHeight, height);
        }
      });
    });

    // Calculate cell dimensions
    const cellWidth = width / gridSizeX;
    const cellHeight = height / gridSizeY;

    // Draw height map cells
    for (let row = 0; row < gridSizeY; row++) {
      for (let col = 0; col < gridSizeX; col++) {
        const heightValue = heightMapData[row] && heightMapData[row][col];
        
        if (heightValue !== null && heightValue !== undefined) {
          const color = this.getColorForHeight(heightValue, minHeight, maxHeight);
          ctx.fillStyle = color;
        } else {
          ctx.fillStyle = '#ddd'; // Gray for no data
        }

        const x = col * cellWidth;
        const y = row * cellHeight;
        
        ctx.fillRect(x, y, cellWidth, cellHeight);
        
        // Draw cell border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);
        
        // Draw height value text
        if (heightValue !== null && heightValue !== undefined) {
          ctx.fillStyle = '#fff';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(
            heightValue.toFixed(2),
            x + cellWidth / 2,
            y + cellHeight / 2 + 4
          );
        }
      }
    }

    // Draw legend
    const legendWidth = 20;
    const legendHeight = height - 40;
    const legendX = width - 30;
    const legendY = 20;

    // Draw gradient legend
    const gradient = ctx.createLinearGradient(0, legendY, 0, legendY + legendHeight);
    gradient.addColorStop(0, this.getColorForHeight(maxHeight, minHeight, maxHeight));
    gradient.addColorStop(1, this.getColorForHeight(minHeight, minHeight, maxHeight));
    
    ctx.fillStyle = gradient;
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
    
    ctx.strokeStyle = '#333';
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

    // Draw legend labels
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(maxHeight.toFixed(2), legendX - 5, legendY + 4);
    ctx.fillText(minHeight.toFixed(2), legendX - 5, legendY + legendHeight);
  };

  render() {
    const { width, height } = this.props;

    return (
      <div className={styles.heightMapVisualizer}>
        <canvas
          ref={this.canvasRef}
          width={width}
          height={height}
          className={styles.canvas}
        />
      </div>
    );
  }
}

export default HeightMapVisualizer;