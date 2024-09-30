import React, { useEffect, useState, useRef } from 'react'
import {
    App,
    Layout,
    theme,
    InputNumber,
    Space,
    Typography,
    Button,
    Drawer,
    Input,
    Table,
    Modal,
    Upload,
    Slider,
    Divider,
    Radio,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { GetProp, UploadFile, UploadProps } from 'antd'
import type { UploadRequestOption } from 'rc-upload/lib/interface'
import { useLocalStorageState } from 'ahooks'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import ImgCrop from 'antd-img-crop'

const { Content } = Layout
const { TextArea } = Input

type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0]

type CellData = {
    value: boolean
}

type DitheringMode = 'floyd-steinberg' | 'threshold'

type GridData = {
    id: string
    name: string
    cells: CellData[]
    createdAt: string
    updatedAt: string
    width: number
    height: number
}

type CustomImageData = {
    imageData: ImageData
    width: number
    height: number
}

const Preview: React.FC<{ grid: GridData }> = ({ grid }) => {
    return (
        <div
            style={{
                padding: 0,
                width: grid!.width,
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${grid!.width}, 1fr)`,
                    gap: 0,
                    width: grid!.width * 2,
                }}
            >
                {Array.from(
                    { length: grid!.width * grid!.height },
                    (_, index) => (
                        <div
                            key={index}
                            style={{
                                backgroundColor: grid.cells[index]?.value
                                    ? 'black'
                                    : 'white',
                                width: '2px',
                                height: '2px',
                                border: '0.5px solid #DDD',
                            }}
                        />
                    )
                )}
            </div>
        </div>
    )
}

const Pixel: React.FC<{
    index: number
    toggleColor: (index: number) => void
    grid: GridData
}> = ({ index, toggleColor, grid }) => {
    return (
        <div
            onClick={() => toggleColor(index)}
            style={{
                backgroundColor: grid.cells[index]?.value ? 'black' : 'white',
                cursor: 'pointer',
                width: '10px',
                height: '10px',
                border: '0.5px solid #DDD',
            }}
        />
    )
}

const PixelArtBoard: React.FC = () => {
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken()

    const { message } = App.useApp()

    const [gridWidthValue, setGridWidthValue] = useState<number>(128)
    const [gridHeightValue, setGridHeightValue] = useState<number>(64)

    const [showHistory, setShowHistory] = useState<boolean>(false)
    const [showImportCode, setShowImportCode] = useState<boolean>(false)
    const [showImportImage, setShowImportImage] = useState<boolean>(false)

    const [codeString, setCodeString] = useState<string>('')

    const [importString, setImportString] = useState<string>('')

    const [ditheringMode, setDitheringMode] =
        useState<DitheringMode>('floyd-steinberg')

    const [importImageData, setImportImageData] = useState<
        CustomImageData | undefined
    >()

    const [ditherImageThreshold, setDitherImageThreshold] =
        useState<number>(128)

    const [history, setHistory] = useLocalStorageState<GridData[]>('history')

    const makeGrid = (): GridData => {
        const defaultCells = Array<CellData>(128 * 64).fill({
            value: false,
        })
        return {
            id: uuidv4(),
            name: `未命名${(history?.length ?? 0) + 1}`,
            cells: defaultCells,
            createdAt: dayjs().format(),
            updatedAt: dayjs().format(),
            width: 128,
            height: 64,
        }
    }

    const [grid, setGrid] = useLocalStorageState<GridData>('current_crid', {
        defaultValue: makeGrid(),
    })
    const previousGrid = useRef(grid)
    const [importPreviewGrid, setImportPreviewGrid] = useState<
        GridData | undefined
    >()

    const binaryArrayToHex = (binaryArray: number[]): number[] => {
        while (binaryArray.length % 8 !== 0) {
            binaryArray.unshift(0)
        }

        const hexArray: number[] = []
        for (let i = 0; i < binaryArray.length; i += 8) {
            const chunk = binaryArray.slice(i, i + 8)
            const hex = parseInt(chunk.join(''), 2) >>> 0
            hexArray.push(hex)
        }

        return hexArray.reverse()
    }

    const copyCode = async () => {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(codeString)
                message.success('复制成功!')
            } catch (err) {
                message.error('复制失败!')
            }
        }
    }
    const getCppCode = () => {
        const chunks: (1 | 0)[][] = []

        for (let i = 0; i < grid!.cells.length; i += grid!.width) {
            chunks.push(
                grid!
                    .cells!.slice(i, i + grid!.width)
                    .map((item) => (item.value ? 1 : 0))
                    .reverse()
            )
        }

        const hex: number[][] = chunks.map((item) => binaryArrayToHex(item))

        const formattedLines = hex.map((subArray) =>
            subArray
                .map((num) => `0x${num.toString(16).padStart(2, '0')}`)
                .join(',')
        )
        const formattedString = formattedLines.join(',\n')
        setCodeString(formattedString)
    }

    const saveGrid = (createANewOne: boolean) => {
        let newGrid = { ...grid! }

        if (createANewOne) {
            newGrid.id = uuidv4()
            newGrid.name = `${newGrid.name} 副本`
        }

        newGrid.updatedAt = dayjs().format()

        let newHistory = [newGrid]

        if (history && history.length > 0) {
            newHistory = [...history, newGrid]
        }

        newHistory = newHistory.reduce((values: GridData[], currentValue) => {
            if (!values.some((item) => item?.id === currentValue!.id)) {
                values.push(currentValue)
            } else {
                let update =
                    values.find((item) => item.id === currentValue.id)
                        ?.updatedAt ?? ''
                if (
                    new Date(update).getTime() <
                    new Date(currentValue.updatedAt).getTime()
                ) {
                    values = [
                        ...values.filter((item) => item.id !== currentValue.id),
                        currentValue,
                    ]
                }
            }
            return values
        }, [])

        setHistory(
            newHistory.sort((a, b) => {
                const dateA = new Date(a.updatedAt)
                const dateB = new Date(b.updatedAt)
                return dateB.getTime() - dateA.getTime()
            })
        )
        setGrid(newGrid)
        message.success('保存成功!')
    }

    const importFromString = () => {
        const cleanedString = importString.replace(/\s+/g, '')
        const hexValues = cleanedString.split(',')

        const n = hexValues.length / grid!.height
        const hexValuesAsNumbers = hexValues.map((hex) => parseInt(hex, 16))
        let result: number[][] = []
        for (let i = 0; i < hexValuesAsNumbers.length; i += n) {
            result.push(hexValuesAsNumbers.slice(i, i + n))
        }

        result = result.map((item) => {
            return item
                .map((num) => {
                    const binaryStr = num.toString(2).padStart(8, '0')
                    const reversedBinaryStr = binaryStr
                        .split('')
                        .reverse()
                        .join('')
                    return reversedBinaryStr
                        .split('')
                        .map((bit) => parseInt(bit, 10))
                })
                .flat()
                .slice(0, grid!.width)
        })
        setGrid({
            ...grid!,
            cells: result.flat().map((item) => {
                return { value: item === 1 } as CellData
            }),
        })
        setImportString('')
    }

    const reSetGrids = () => {
        setGrid({
            ...grid!,
            cells: Array<CellData>(grid!.width * grid!.height).fill({
                value: false,
            }),
        })
    }

    const fixGrids = (newWidth: number, newHeight: number) => {
        const newCells: CellData[] = Array(newWidth * newHeight).fill({
            value: false,
        })

        // 计算旧 cells 数组的尺寸
        const oldWidth = previousGrid.current?.width ?? 0
        const oldHeight = previousGrid.current?.height ?? 0
        const oldCells = previousGrid.current?.cells!

        const minWidth = Math.min(newWidth, oldWidth)
        const minHeight = Math.min(newHeight, oldHeight)

        // 将旧 cells 数组的数据复制到新数组中
        for (let y = 0; y < minHeight; y++) {
            for (let x = 0; x < minWidth; x++) {
                const oldIndex = y * oldWidth + x
                const newIndex = y * newWidth + x
                if (oldCells[oldIndex]) {
                    newCells[newIndex] = oldCells[oldIndex]
                }
            }
        }

        setGrid({
            ...grid!,
            cells: newCells,
            width: newWidth,
            height: newHeight,
        })
    }

    const updateSize = (width: number, height: number) => {
        fixGrids(width, height)
    }

    const invertGrids = () => {
        setGrid({
            ...grid!,
            cells: grid!.cells?.map((item, index) => {
                let newItem = { ...item }
                newItem.value = !newItem.value
                return newItem
            }),
        })
    }

    const toggleColor = (index: number) => {
        const newCells = grid?.cells?.map((item, mapIndex) => {
            if (mapIndex === index) {
                let newItem = { ...item }
                newItem.value = !newItem.value
                return newItem
            }
            return item
        })

        setGrid({
            ...grid!,
            cells: newCells ?? [],
        })
    }
    const shiftUp = () => {
        setGrid({
            ...grid!,
            cells: Array<CellData>(grid!.width * grid!.height)
                .fill({
                    value: false,
                })
                .map((item, index) => {
                    if (grid && grid.cells[index + grid!.width]) {
                        return grid.cells[index + grid!.width]
                    }
                    return item
                }),
        })
    }

    const shiftDown = () => {
        setGrid({
            ...grid!,
            cells: Array<CellData>(grid!.width * grid!.height)
                .fill({
                    value: false,
                })
                .map((item, index) => {
                    if (grid && grid.cells[index - grid!.width]) {
                        return grid.cells[index - grid!.width]
                    }
                    return item
                }),
        })
    }

    const shiftLeft = () => {
        setGrid({
            ...grid!,
            cells: Array<CellData>(grid!.width * grid!.height)
                .fill({
                    value: false,
                })
                .map((item, index) => {
                    if (
                        grid &&
                        grid.cells[index + 1] &&
                        (index + 1) % grid!.width !== 0
                    ) {
                        return grid.cells[index + 1]
                    }
                    return item
                }),
        })
    }

    const shiftRight = () => {
        setGrid({
            ...grid!,
            cells: Array<CellData>(grid!.width * grid!.height)
                .fill({
                    value: false,
                })
                .map((item, index) => {
                    if (
                        grid &&
                        grid.cells[index - 1] &&
                        index % grid!.width !== 0
                    ) {
                        return grid.cells[index - 1]
                    }
                    return item
                }),
        })
    }

    const onPreview = async (file: UploadFile) => {
        let src = file.url as string
        if (!src) {
            src = await new Promise((resolve) => {
                const reader = new FileReader()
                reader.readAsDataURL(file.originFileObj as FileType)
                reader.onload = () => resolve(reader.result as string)
            })
        }
        const image = document.createElement('img')
        image.src = src
        const imgWindow = window.open(src)
        imgWindow?.document.write(image.outerHTML)
    }

    const floydSteinbergDithering = (
        data: Uint8ClampedArray,
        width: number,
        height: number,
        thresholdValue: number
    ) => {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let i = (y * width + x) * 4
                let r = data[i]
                let g = data[i + 1]
                let b = data[i + 2]
                let gray = Math.round(0.3 * r + 0.59 * g + 0.11 * b)
                let quantizedGray = gray < thresholdValue ? 0 : 255

                data[i] = data[i + 1] = data[i + 2] = quantizedGray

                let quantError = gray - quantizedGray

                if (x + 1 < width) {
                    data[i + 4] += (quantError * 7) / 16
                }
                if (y + 1 < height) {
                    if (x > 0) {
                        data[(y * width + x - 1) * 4 + 2] +=
                            (quantError * 3) / 16
                    }
                    data[(y * width + x + 1) * 4] += (quantError * 5) / 16
                    if (x + 1 < width) {
                        data[(y * width + x + 2) * 4] += (quantError * 1) / 16
                    }
                }
            }
        }
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let i = (y * width + x) * 4
                let r = data[i]
                let g = data[i + 1]
                let b = data[i + 2]

                if (r < 128 || g < 128 || b < 128) {
                    data[i] = data[i + 1] = data[i + 2] = 0
                } else {
                    data[i] = data[i + 1] = data[i + 2] = 255
                }
                data[i + 3] = 255
            }
        }
    }

    const thresholdDithering = (
        data: Uint8ClampedArray,
        width: number,
        height: number,
        thresholdValue: number
    ) => {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let i = (y * width + x) * 4
                let r = data[i]
                let g = data[i + 1]
                let b = data[i + 2]
                let gray = Math.round(0.3 * r + 0.59 * g + 0.11 * b)
                let quantizedGray = gray < thresholdValue ? 0 : 255

                data[i] = data[i + 1] = data[i + 2] = quantizedGray
            }
        }
    }

    const imageDataToGridData = (importImageData: CustomImageData) => {
        const { imageData, width, height } = importImageData

        const newCells: CellData[] = Array(width * height).fill({
            value: false,
        })

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let i = (y * width + x) * 4
                newCells[y * width + x] = { value: imageData.data[i] === 0 }
            }
        }

        setImportPreviewGrid({
            id: uuidv4(),
            name: `未命名${(history?.length ?? 0) + 1}`,
            createdAt: dayjs().format(),
            updatedAt: dayjs().format(),
            cells: newCells,
            width: width,
            height: height,
        })
    }

    const imagePixelation = (importImageData: CustomImageData | undefined) => {
        if (importImageData) {
            const { imageData, width, height } = importImageData

            const copiedImageData: ImageData = new ImageData(
                imageData.width,
                imageData.height
            )
            imageData.data.forEach((value, index) => {
                copiedImageData.data[index] = value
            })

            const data = copiedImageData.data

            if (ditheringMode === 'floyd-steinberg') {
                floydSteinbergDithering(
                    data,
                    width,
                    height,
                    ditherImageThreshold
                )
            } else {
                thresholdDithering(data, width, height, ditherImageThreshold)
            }

            imageDataToGridData({ imageData: copiedImageData, width, height })
        }
    }

    const customRequest = (options: UploadRequestOption) => {
        const { onSuccess, onError, file, onProgress } = options

        const reader = new FileReader()
        reader.onprogress = (event) => {
            const percent = (event.loaded / event.total) * 100
            if (onProgress) {
                onProgress({ percent })
            }
        }

        reader.onload = (event) => {
            const fileResult = event.target?.result
            if (onSuccess) {
                onSuccess('ok')
            }
            const image = document.createElement('img')
            image.src = fileResult as string
            image.addEventListener('load', () => {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')

                if (ctx) {
                    let scale
                    if (image.width > image.height) {
                        scale = 128 / image.width
                    } else {
                        scale = 128 / image.height
                    }
                    canvas.width = image.width * scale
                    canvas.height = image.height * scale

                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

                    const imageData = ctx.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    )
                    const newImageData = {
                        imageData: imageData,
                        width: canvas.width,
                        height: canvas.height,
                    }
                    setImportImageData(newImageData)

                    imagePixelation(newImageData)
                }
            })
        }
        reader.onerror = (event) => {
            if (onError) {
                onError(event)
            }
        }

        reader.readAsDataURL(file as Blob)
    }

    useEffect(
        () => {
            fixGrids(grid!.width, grid!.height)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    useEffect(
        () => {
            getCppCode()
            previousGrid.current = grid
            setGridWidthValue(grid!.width)
            setGridHeightValue(grid!.height)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [grid]
    )

    useEffect(
        () => {
            imagePixelation(importImageData)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ditherImageThreshold, ditheringMode]
    )

    return (
        <Layout>
            <Content>
                <Space
                    style={{ margin: 10, minHeight: 600 }}
                    direction="vertical"
                >
                    <Space style={{ margin: 10 }} direction="vertical">
                        <Space>
                            <Space style={{ marginRight: 40, width: 200 }}>
                                <Typography.Text
                                    editable={{
                                        onChange(value) {
                                            setGrid({ ...grid!, name: value })
                                        },
                                    }}
                                >
                                    {grid?.name}
                                </Typography.Text>
                            </Space>
                            <Button
                                onClick={() => {
                                    setGrid(makeGrid())
                                }}
                            >
                                新建
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => {
                                    saveGrid(false)
                                }}
                            >
                                保存
                            </Button>
                            <Button
                                onClick={() => {
                                    saveGrid(true)
                                }}
                            >
                                另存
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowHistory(true)
                                }}
                            >
                                读取...
                            </Button>
                        </Space>
                        <Space>
                            <Typography>设置宽高: </Typography>
                            <InputNumber
                                min={1}
                                max={128}
                                placeholder="宽"
                                value={gridWidthValue}
                                onChange={(value) => {
                                    setGridWidthValue(value ?? 1)
                                }}
                                onPressEnter={(e) => {
                                    updateSize(gridWidthValue, gridHeightValue)
                                }}
                                onStep={(value) => {
                                    updateSize(value, gridHeightValue)
                                }}
                            />
                            X
                            <InputNumber
                                min={1}
                                max={128}
                                placeholder="高"
                                value={gridHeightValue}
                                onChange={(value) => {
                                    setGridHeightValue(value ?? 1)
                                }}
                                onPressEnter={(e) => {
                                    updateSize(gridWidthValue, gridHeightValue)
                                }}
                                onStep={(value) => {
                                    updateSize(gridWidthValue, value)
                                }}
                            />
                            <Button onClick={shiftUp}>上移</Button>
                            <Button onClick={shiftDown}>下移</Button>
                            <Button onClick={shiftLeft}>左移</Button>
                            <Button onClick={shiftRight}>右移</Button>
                            <Button onClick={invertGrids}>反色</Button>
                            <Button
                                onClick={() => {
                                    setShowImportImage(true)
                                }}
                            >
                                导入图片...
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowImportCode(true)
                                }}
                            >
                                导入代码...
                            </Button>
                            <Button danger onClick={reSetGrids}>
                                清空
                            </Button>
                        </Space>
                    </Space>
                    <div
                        style={{
                            background: colorBgContainer,
                            padding: 24,
                            borderRadius: borderRadiusLG,
                            width: grid!.width * 10 + 48,
                        }}
                    >
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${
                                    grid!.width
                                }, 1fr)`,
                                gap: 0,
                                width: grid!.width * 10,
                            }}
                        >
                            {Array.from(
                                { length: grid!.width * grid!.height },
                                (_, index) => (
                                    <Pixel
                                        key={index}
                                        index={index}
                                        toggleColor={toggleColor}
                                        grid={grid!}
                                    ></Pixel>
                                )
                            )}
                        </div>
                    </div>
                    <Button type="primary" onClick={copyCode}>
                        复制代码
                    </Button>
                    <TextArea rows={6} value={codeString} />
                </Space>
                <Modal
                    open={showImportImage}
                    title="导入图片"
                    onClose={() => setShowImportImage(false)}
                    onCancel={() => setShowImportImage(false)}
                    onOk={() => {
                        if (importPreviewGrid) {
                            setGrid(importPreviewGrid)
                        }
                        setShowImportImage(false)
                    }}
                >
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <ImgCrop
                            rotationSlider
                            aspectSlider
                            showReset
                            showGrid
                            aspect={2}
                            maxZoom={10}
                        >
                            <Upload
                                accept="image/*"
                                listType="picture-card"
                                maxCount={1}
                                customRequest={customRequest}
                                onPreview={onPreview}
                            >
                                <UploadOutlined />
                                上传图片
                            </Upload>
                        </ImgCrop>
                        {importPreviewGrid && (
                            <>
                                <Divider />
                                <Typography.Text strong>
                                    取模算法
                                </Typography.Text>
                                <Radio.Group
                                    onChange={(e) => {
                                        setDitheringMode(e.target.value)
                                    }}
                                    value={ditheringMode}
                                >
                                    <Radio value="floyd-steinberg">
                                        抖动取模
                                    </Radio>
                                    <Radio value="threshold">阈值取模</Radio>
                                </Radio.Group>

                                <Typography.Text strong>
                                    阈值调节
                                </Typography.Text>
                                <Slider
                                    value={ditherImageThreshold}
                                    onChange={setDitherImageThreshold}
                                    max={200}
                                    min={10}
                                />
                                <Space>
                                    <Preview grid={importPreviewGrid} />
                                </Space>
                            </>
                        )}
                    </Space>
                </Modal>
                <Modal
                    open={showImportCode}
                    title="导入 16 进制代码"
                    onClose={() => setShowImportCode(false)}
                    onCancel={() => setShowImportCode(false)}
                    onOk={() => {
                        importFromString()
                        setShowImportCode(false)
                    }}
                >
                    <Space direction="vertical" style={{ width: '100%' }}>
                        导入前请确保已经设置好对应的宽高
                        <TextArea
                            placeholder="例如: 0x08,0x0c,0x08,0x08,0x08,0x08,0x08,0x1c"
                            rows={5}
                            value={importString}
                            onChange={(e) => {
                                setImportString(e.target.value)
                            }}
                        />
                    </Space>
                </Modal>
                <Drawer
                    width={1200}
                    open={showHistory}
                    onClose={() => {
                        setShowHistory(false)
                    }}
                >
                    <Table
                        dataSource={history}
                        rowKey="id"
                        columns={[
                            { title: '名称', dataIndex: 'name', key: 'name' },
                            {
                                title: '预览',
                                key: 'preview',
                                render: (value, record, index) => {
                                    return <Preview grid={record} />
                                },
                            },
                            {
                                title: '操作',
                                key: 'action',
                                render: (value, record, index) => {
                                    return [
                                        <Space key="buttons">
                                            <Button
                                                onClick={() => {
                                                    setGrid(
                                                        history?.find(
                                                            (item) =>
                                                                item.id ===
                                                                record.id
                                                        )
                                                    )

                                                    setShowHistory(false)
                                                }}
                                            >
                                                读取
                                            </Button>
                                            <Button
                                                danger
                                                onClick={() => {
                                                    setHistory(
                                                        history?.filter(
                                                            (item) =>
                                                                item.id !==
                                                                record.id
                                                        )
                                                    )
                                                }}
                                            >
                                                删除
                                            </Button>
                                        </Space>,
                                    ]
                                },
                            },
                        ]}
                    ></Table>
                </Drawer>
            </Content>
        </Layout>
    )
}

const MyApp: React.FC = () => (
    <App>
        <PixelArtBoard />
    </App>
)

export default MyApp
